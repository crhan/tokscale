use chrono::{Local, NaiveDate, Timelike};
use ratatui::prelude::*;
use ratatui::widgets::{
    Block, Borders, Cell, Paragraph, Row, Scrollbar, ScrollbarOrientation, ScrollbarState, Table,
};

use super::widgets::{format_cache_hit_rate, format_cost, format_cost_per_million, format_tokens};
use crate::tui::app::{App, SortDirection, SortField};

pub fn render(frame: &mut Frame, app: &mut App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(app.theme.border))
        .title(Span::styled(
            " Hourly Usage ",
            Style::default()
                .fg(app.theme.accent)
                .add_modifier(Modifier::BOLD),
        ))
        .style(Style::default().bg(app.theme.background));

    let inner = block.inner(area);
    frame.render_widget(block, area);

    let visible_height = inner.height.saturating_sub(1) as usize;
    app.max_visible_items = visible_height;

    let hourly = app.get_sorted_hourly();
    if hourly.is_empty() {
        let empty_msg = Paragraph::new("No hourly usage data found. Press 'r' to refresh.")
            .style(Style::default().fg(app.theme.muted))
            .alignment(Alignment::Center);
        frame.render_widget(empty_msg, inner);
        return;
    }

    // hourly 有 12 列，用独立的宽度断点，不依赖全局 is_narrow()/is_very_narrow()。
    // < 75: 极窄，只保留 Hour + Cost 两列
    // < 110: 紧凑，显示 6 列并用 %H:00 格式省去日期前缀
    // >= 110: 正常，展开全部 12 列，日期显示 %m/%d %H:00
    let is_very_narrow = app.terminal_width < 75;
    let is_narrow = app.terminal_width < 110;
    let sort_field = app.sort_field;
    let sort_direction = app.sort_direction;
    let scroll_offset = app.scroll_offset;
    let selected_index = app.selected_index;
    let theme_accent = app.theme.accent;
    let theme_selection = app.theme.selection;
    let now = Local::now().naive_local();
    let current_hour = now
        .date()
        .and_hms_opt(now.hour(), 0, 0)
        .unwrap_or(now);

    let header_cells = if is_very_narrow {
        vec!["Hour", "Cost"]
    } else if is_narrow {
        vec!["Hour", "Source", "Turn", "Msgs", "Tokens", "Cost"]
    } else {
        vec![
            "Hour", "Source", "Turn", "Msgs", "Input", "Output", "Cache R", "Cache W", "Cache×",
            "Total", "Cost", "Cost/1M",
        ]
    };

    let sort_indicator = |field: SortField| -> &'static str {
        if sort_field == field {
            match sort_direction {
                SortDirection::Ascending => " ▲",
                SortDirection::Descending => " ▼",
            }
        } else {
            ""
        }
    };

    let header = Row::new(
        header_cells
            .iter()
            .enumerate()
            .map(|(i, h)| {
                let indicator = match (i, is_narrow, is_very_narrow) {
                    (0, _, _) => sort_indicator(SortField::Date),
                    (9, false, false) => sort_indicator(SortField::Tokens),
                    (4, true, false) => sort_indicator(SortField::Tokens),
                    (10, false, false) => sort_indicator(SortField::Cost),
                    (5, true, false) => sort_indicator(SortField::Cost),
                    (1, _, true) => sort_indicator(SortField::Cost),
                    _ => "",
                };
                Cell::from(format!("{}{}", h, indicator))
            })
            .collect::<Vec<_>>(),
    )
    .style(
        Style::default()
            .fg(theme_accent)
            .add_modifier(Modifier::BOLD),
    )
    .height(1);

    let hourly_len = hourly.len();
    let start = scroll_offset.min(hourly_len);
    let end = (start + visible_height).min(hourly_len);

    if start >= hourly_len {
        return;
    }

    // Number of extra (non-date) cells per row in each display mode — used when
    // building separator rows so they always have the right cell count.
    let extra_cell_count = if is_very_narrow {
        1
    } else if is_narrow {
        5
    } else {
        11
    };

    // Muted style for day-boundary separator rows.
    let sep_style = Style::default().fg(Color::Rgb(110, 110, 110));

    // Build a separator row for the given date.
    // The first cell holds a centered label; remaining cells are empty to
    // match the column count of the current display mode.
    let make_separator = |date: NaiveDate| -> Row {
        let label = format!("── {} ──", date.format("%m/%d"));
        let mut cells: Vec<Cell> = Vec::with_capacity(extra_cell_count + 1);
        cells.push(Cell::from(label).style(sep_style));
        cells.extend((0..extra_cell_count).map(|_| Cell::from("")));
        Row::new(cells).style(sep_style).height(1)
    };

    // Track the date of the last row *before* the visible window so that we
    // can detect a day boundary at the very first visible row.
    let mut prev_date: Option<NaiveDate> = if start > 0 {
        Some(hourly[start - 1].datetime.date())
    } else {
        None
    };

    let mut rows: Vec<Row> = Vec::with_capacity(end - start + 4); // +4 for possible separators

    for (i, hour) in hourly[start..end].iter().enumerate() {
        let idx = i + start;
        let is_selected = idx == selected_index;
        let is_striped = idx % 2 == 1;
        let is_current = hour.datetime == current_hour;
        let current_date = hour.datetime.date();

        // Insert a day-boundary separator whenever the date changes.
        if prev_date.map_or(false, |d| d != current_date) {
            rows.push(make_separator(current_date));
        }
        prev_date = Some(current_date);

        let clients_str: String = {
            let mut c: Vec<&str> = hour.clients.iter().map(String::as_str).collect();
            c.sort();
            c.join(", ")
        };

        // Format the hour bucket as HH:00 (very_narrow / narrow) or MM/DD HH:00 (normal).
        // Using literal ":00" makes it unambiguous that this is an hour bucket, not a
        // specific minute.  Chrono treats non-% characters as literals, so "%H:00" and
        // "%m/%d %H:00" both work as expected.
        let date_str: String = if is_very_narrow || is_narrow {
            hour.datetime.format("%H:00").to_string()
        } else {
            hour.datetime.format("%m/%d %H:00").to_string()
        };

        let date_style = if is_current {
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD)
        } else if !is_very_narrow && !is_narrow {
            // Normal mode: bold all date cells for readability at wider widths.
            Style::default().add_modifier(Modifier::BOLD)
        } else {
            Style::default()
        };

        let cells: Vec<Cell> = if is_very_narrow {
            vec![
                Cell::from(date_str).style(date_style),
                Cell::from(format_cost(hour.cost)).style(Style::default().fg(Color::Green)),
            ]
        } else if is_narrow {
            let turn_str = if hour.turn_count > 0 {
                hour.turn_count.to_string()
            } else {
                "\u{2014}".to_string()
            };
            vec![
                Cell::from(date_str).style(date_style),
                Cell::from(clients_str),
                Cell::from(turn_str),
                Cell::from(hour.message_count.to_string()),
                Cell::from(format_tokens(hour.tokens.total())),
                Cell::from(format_cost(hour.cost)).style(Style::default().fg(Color::Green)),
            ]
        } else {
            let turn_str = if hour.turn_count > 0 {
                hour.turn_count.to_string()
            } else {
                "\u{2014}".to_string()
            };
            vec![
                Cell::from(date_str).style(date_style),
                Cell::from(clients_str),
                Cell::from(turn_str),
                Cell::from(hour.message_count.to_string()),
                Cell::from(format_tokens(hour.tokens.input))
                    .style(Style::default().fg(Color::Rgb(100, 200, 100))),
                Cell::from(format_tokens(hour.tokens.output))
                    .style(Style::default().fg(Color::Rgb(200, 100, 100))),
                Cell::from(format_tokens(hour.tokens.cache_read))
                    .style(Style::default().fg(Color::Rgb(100, 150, 200))),
                Cell::from(format_tokens(hour.tokens.cache_write))
                    .style(Style::default().fg(Color::Rgb(200, 150, 100))),
                Cell::from(format_cache_hit_rate(
                    hour.tokens.cache_read,
                    hour.tokens.input,
                    hour.tokens.cache_write,
                ))
                .style(Style::default().fg(Color::Cyan)),
                Cell::from(format_tokens(hour.tokens.total())),
                Cell::from(format_cost(hour.cost)).style(Style::default().fg(Color::Green)),
                Cell::from(format_cost_per_million(hour.cost, hour.tokens.total()))
                    .style(Style::default().fg(Color::Rgb(150, 200, 150))),
            ]
        };

        let row_style = if is_selected {
            Style::default().bg(theme_selection)
        } else if is_current {
            Style::default().bg(Color::Rgb(28, 42, 34))
        } else if is_striped {
            Style::default().bg(Color::Rgb(20, 24, 30))
        } else {
            Style::default()
        };

        rows.push(Row::new(cells).style(row_style).height(1));
    }

    // Column widths (hourly-specific breakpoints, independent of global is_narrow).
    //
    // very_narrow (<75 cols):  Date 35 % + Cost 65 %
    //   Only Hour + Cost; "HH:00" fits in 5 chars.
    //
    // narrow (<110 cols):  6-column layout, Date 12 %.
    //   "%H:00" saves the 6-char date prefix; Source gets 33 % for client names.
    //
    // normal (≥110 cols): full 12-column layout.
    //   Date Length(12) for "%m/%d %H:00"; Source Length(20) for session names.
    let widths = if is_very_narrow {
        vec![Constraint::Percentage(35), Constraint::Percentage(65)]
    } else if is_narrow {
        vec![
            Constraint::Percentage(12),
            Constraint::Percentage(33),
            Constraint::Percentage(12),
            Constraint::Percentage(13),
            Constraint::Percentage(15),
            Constraint::Percentage(15),
        ]
    } else {
        vec![
            Constraint::Length(12),
            Constraint::Length(20),
            Constraint::Length(6),
            Constraint::Length(6),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(8),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(9),
        ]
    };

    let table = Table::new(rows, widths)
        .header(header)
        .row_highlight_style(Style::default().bg(theme_selection));

    frame.render_widget(table, inner);

    if hourly_len > visible_height {
        let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
            .begin_symbol(Some("▲"))
            .end_symbol(Some("▼"));

        let mut scrollbar_state = ScrollbarState::new(hourly_len).position(scroll_offset);

        frame.render_stateful_widget(
            scrollbar,
            area.inner(Margin {
                horizontal: 0,
                vertical: 1,
            }),
            &mut scrollbar_state,
        );
    }
}
