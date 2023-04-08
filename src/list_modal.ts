import { App, Notice, SuggestModal } from "obsidian";
import { Todo, getDailyNoteTodos, updateDailyNoteTodo } from "./utils";
import { Pomotodoapi } from "./pomotodoapi";


export class PomoTodoListModal extends SuggestModal<Todo> {
  startAt: string;
  pomoLength: number;
  apiKey: string;
  constructor(app: App, startAt: string, pomoLength: number, apiKey: string) {
    super(app);
    this.startAt = startAt;
    this.pomoLength = pomoLength;
    this.apiKey = apiKey;
  }
  // Returns all available suggestions.
  async getSuggestions(query: string): Promise<Todo[]> {
    return getDailyNoteTodos(this.app);
  }
  // Renders each suggestion item.
  renderSuggestion(todo: Todo, el: HTMLElement) {
    const todoCheckbox = el.createEl("input", { type: "checkbox" });
    todoCheckbox.setText(todo.description.trim());
    el.createEl("label", { text: todo.description });
    for (let i = 0; i < todo.sub_todos.length; ++i) {
      el.createEl("ul", {
        text: todo.sub_todos[i].description
      });
    }
  }

  // Perform action on the selected suggestion.
  async onChooseSuggestion(todo: Todo, evt: MouseEvent | KeyboardEvent) {
    const pomotodoapi = new Pomotodoapi(this.apiKey);
    try {
      await pomotodoapi.createPomo(todo.description, this.startAt, this.pomoLength);
      const uuidResponse = await pomotodoapi.finishTodo(todo.uuid);
      if (uuidResponse === todo.uuid) {
        updateDailyNoteTodo(this.app, todo.uuid);
      }
    } catch (error) {
      new Notice(`task ${todo.description} uploaded failed: ${error.message}`);
    }
  }
}