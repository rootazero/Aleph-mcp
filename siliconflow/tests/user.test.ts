import { describe, it, expect } from "vitest";
import { parseUserInfo, parseModelList, userTools } from "../src/user";

describe("parseUserInfo", () => {
  it("maps nested data fields", () => {
    expect(
      parseUserInfo({
        data: {
          name: "Ann",
          email: "a@x.com",
          totalBalance: "10",
          chargeBalance: "7",
          balance: "3",
        },
      }),
    ).toEqual({
      name: "Ann",
      email: "a@x.com",
      total_balance: "10",
      charge_balance: "7",
      gift_balance: "3",
    });
  });
  it("falls back to the top-level object when data is absent", () => {
    expect(parseUserInfo({ name: "Bo" }).name).toBe("Bo");
  });
});

describe("parseModelList", () => {
  it("extracts ids and skips entries without an id", () => {
    expect(parseModelList({ data: [{ id: "a" }, { x: 1 }, { id: "b" }] })).toEqual(["a", "b"]);
  });
});

describe("userTools", () => {
  it("registers get_user_info and list_models", () => {
    expect(userTools.map((t) => t.name).sort()).toEqual(["get_user_info", "list_models"]);
  });
});
