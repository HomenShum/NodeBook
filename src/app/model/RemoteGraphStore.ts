import { GetGraphResponse, GetGraphResponseSchema, PostGraphResponseSchema } from "@/app/api/graph/types";
import axios, { AxiosInstance } from "axios";

export class RemoteGraphStore {
  private client: AxiosInstance;
  constructor() {
    this.client = axios.create({
      baseURL: "/api/graph",
    });
  }

  async load(): Promise<GetGraphResponse> {
    const res = await this.client.get("/");
    return GetGraphResponseSchema.parse(res.data);
  }

  async upsertNode(id: string, text: string, thoughtstreamPosition: string | null): Promise<void> {
    const res = await this.client.post("/", {
      type: "upsert",
      nodes: [{ id, text, thoughtstreamPosition }],
    });
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }

  async deleteNode(id: string): Promise<void> {
    const res = await this.client.post("/", { type: "delete", nodes: [{ id }] });
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }

  async upsertRelation(id: string, fromId: string, toId: string, typeId: string): Promise<void> {
    const res = await this.client.post("/", {
      type: "upsert",
      relations: [{ id, fromId, toId, typeId }],
    });
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }

  async deleteRelation(id: string): Promise<void> {
    const res = await this.client.post("/", { type: "delete", relations: [{ id }] });
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }

  async upsertRelationType(id: string, label: string, reverseLabel: string): Promise<void> {
    const res = await this.client.post("/", {
      type: "upsert",
      relationTypes: [{ id, label, reverseLabel }],
    });
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }

  async deleteRelationType(id: string): Promise<void> {
    const res = await this.client.post("/", { type: "delete", relations: [{ id }] });
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }

  async deleteAll(): Promise<void> {
    const res = await this.client.delete("/");
    const { success, message } = PostGraphResponseSchema.parse(res.data);
    if (!success) {
      throw new Error(message);
    }
  }
}
