import { request, moment } from 'obsidian';


const API_URL = 'https://api.pomotodo.com/1';

export class Pomotodoapi {
  key: string;
  constructor(key: string) {
    this.key = key;
  }
  async getAccountInfo(): Promise<string> {
    const data = await request({
      url: `${API_URL}/account`,
      method: "GET",
      headers: { 'Authorization': `token ${this.key}` },
      contentType: "application/json"
    })

    return JSON.parse(data).pro_expires_time;
  }

  async createTodo(content: string): Promise<string> {
    const data = await request({
      url: `${API_URL}/todos`,
      method: "POST",
      body: JSON.stringify({
        "description": `${content}`,
      }),
      headers: { 'Authorization': `token ${this.key}` },
      contentType: "application/json"
    })
    return JSON.parse(data).uuid;
  }

  async finishTodo(uuid: string): Promise<string> {
    const requestData = {
      url: `${API_URL}/todos/${uuid}`,
      method: "PATCH",
      body: JSON.stringify({ "completed": true }),
      headers: { 'Authorization': `token ${this.key}` },
      contentType: "application/json",
      throw: false
    };
    const data = await request(requestData);
    return JSON.parse(data).uuid;
  }

  async modifyTodo(uuid: string, description: string): Promise<String> {
    const requestData = {
      url: `${API_URL}/todos/${uuid}`,
      method: "PATCH",
      body: JSON.stringify({ "completed": false, "description": `${description}` }),
      headers: { 'Authorization': `token ${this.key}` },
      contentType: "application/json",
      throw: false
    };
    const data = await request(requestData);
    return JSON.parse(data).uuid;
  }

  async createSubTodo(content: string, parentUUID: string): Promise<string> {
    console.log("post subTodo", content);
    const data = await request({
      url: `${API_URL}/todos/${parentUUID}/sub_todos`,
      method: "POST",
      body: JSON.stringify({ "description": `${content}` }),
      headers: { 'Authorization': `token ${this.key}` },
      contentType: "application/json"
    });
    return JSON.parse(data).uuid;
  }

  async finishSubTodo(content: string, parentUUID: string, uuid: string): Promise<string> {
    const data = await request({
      url: `${API_URL}/todos/${parentUUID}/sub_todos/${uuid}`,
      method: "PATCH",
      body: JSON.stringify({ "uuid": uuid, "parent_uuid": parentUUID, "complete": true, "completed_at": moment(0) }),
      headers: { 'Authorization': `token ${this.key}` },
      contentType: "application/json"
    });
    return JSON.parse(data).uuid;
  }

  /**
   * Creates a new pomodoro.
   * @param description - The description of the pomodoro.
   * @param startAt - The start time of the pomodoro.
   * @param length - The lenght in seconds of the pomodoro
   * @returns The UUID of the created pomodoro.
   */
  async createPomo(description: string, startAt: string, length: number): Promise<string> {
    try {
      const data = await request({
        url: `${API_URL}/pomos`,
        method: "POST",
        body: JSON.stringify({
          "description": `${description}`,
          "started_at": `${startAt}`,
          "length": length,
        }),
        headers: { 'Authorization': `token ${this.key}` },
        contentType: "application/json"
      });

      return JSON.parse(data).uuid;
    } catch (error) {
      throw new Error(`Failed to create pomodoro: ${error.message}`)
    }
  }

  async modifyPomo(uuid: string, description: string): Promise<string> {
    try {
      const data = await request({
        url: `${API_URL}/pomos/${uuid}`,
        method: "PATCH",
        body: JSON.stringify({
          "description": `${description}`,
        }),
        headers: { 'Authorization': `token ${this.key}` },
        contentType: "application/json"
      });

      return JSON.parse(data).uuid;
    } catch (error) {
      throw new Error(`Failed to finish pomodoro: ${error.message}`)
    }
  }




}