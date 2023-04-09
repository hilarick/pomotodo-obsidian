import { App, Notice, moment, TFolder, TFile } from 'obsidian';
import { getDailyNote, createDailyNote, getAllDailyNotes } from 'obsidian-daily-notes-interface';

export interface Todo {
  description: string;
  uuid: string;
  sub_todos: Todo[];
}

export function getDailyNoteFile(): TFile {
  try {
    const file = getDailyNote(moment() as any, getAllDailyNotes());
    return file;
  } catch (error) {
    console.log(error);
    throw new Error('Error getting daily note file');
  }
}

export async function getDailyNoteTodos(app: App): Promise<Todo[]> {
  try {
    const todayNoteFile = getDailyNoteFile();
    let todos: Todo[] = [];
    let existingContent = await app.vault.adapter.read(todayNoteFile.path);
    const lines = existingContent.split("\n");
    let lastTodoIndex: number;
    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      console.log(`read line ${i}` + line);
      if (line.startsWith("- [ ]")) {
        const todo: Todo = { description: '', uuid: '', sub_todos: [] };
        const splits = line.split('^');
        todo.description = splits[0].substring(5);
        todo.uuid = splits[1];
        todos.push(todo);

        lastTodoIndex = todos.length - 1;
      }
      else if (line.startsWith("\t- [ ]")) {
        const subTodo: Todo = { description: '', uuid: '', sub_todos: [] };
        const splits = line.split('^');
        subTodo.description = splits[0].substring(6);
        subTodo.uuid = splits[1];

        let todo = todos[lastTodoIndex];
        todo.sub_todos.push(subTodo);
      }
    }
    return todos;
  } catch (error) {
    console.log(error);
    throw new Error('Error getting daily note todos');
  }
}

export async function updateDailyNoteTodo(app: App, uuid: string, endTime: string): Promise<boolean> {
  try {
    const todayNoteFile = getDailyNoteFile();

    let existingContent = await app.vault.adapter.read(todayNoteFile.path);
    const lines = existingContent.split("\n");

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      console.log(`update read line ${i}` + line);
      if (line.startsWith("- [ ]")) {
        const splits = line.split('^');
        const uuidInline = splits[1];
        if (uuid === uuidInline) {
          const modifiedLine = line.concat(` completed:: ${endTime}`);
          lines.splice(i, 1, modifiedLine.replace("- [ ]", "- [x]"));

          break;

          ///todo , I should add to the sub_todos
        }
      }
    }
    await app.vault.adapter.write(todayNoteFile.path, lines.join('\n'));
    return true;
  } catch (error) {
    console.log(error);
    throw new Error('Error getting daily note todos');
  }
}
