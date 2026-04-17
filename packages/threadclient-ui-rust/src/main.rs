use iced::widget::{
    column, text,
};
use iced::{Element, Font, Task, Theme};

fn main() -> iced::Result {
    iced::application(UI::new, UI::update, UI::view)
        .theme(UI::theme)
        .default_font(Font::MONOSPACE)
        .run()
}

struct UI {}

enum Message {}

impl UI {
    fn new() -> (Self, Task<Message>) {
        (
            Self {},
            Task::none(),
        )
    }

    fn update(&mut self, message: Message) -> Task<Message> {
        match message {

        }
    }

    fn view(&self) -> Element<'_, Message> {
        column!(
            text(String::from("abc"))
        ).spacing(10).padding(10).into()
    }

    fn theme(&self) -> Theme {
        Theme::Dark
    }
}
