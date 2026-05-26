import { describe, expect, it } from "vitest";
import { getBoardPickNumber, getPickTeamIndex, ratingLabel } from "./draftLogic.js";
import { STARTER_PLAYERS } from "../data/players.js";

describe("draft logic", () => {
  it("loads the complete ranked player pool", () => {
    expect(STARTER_PLAYERS).toHaveLength(200);
    expect(STARTER_PLAYERS[0].rank).toBe(1);
    expect(STARTER_PLAYERS[199].rank).toBe(200);
  });

  it("uses classic snake ordering", () => {
    expect(getPickTeamIndex(1, 20, true)).toBe(0);
    expect(getPickTeamIndex(20, 20, true)).toBe(19);
    expect(getPickTeamIndex(21, 20, true)).toBe(19);
    expect(getPickTeamIndex(40, 20, true)).toBe(0);
  });

  it("shows reverse pick numbers on round 2 of the board", () => {
    expect(getBoardPickNumber(2, 0, 20, true)).toBe(40);
    expect(getBoardPickNumber(2, 19, 20, true)).toBe(21);
  });

  it("normalises the Okay label", () => {
    expect(ratingLabel("OKay")).toBe("Okay");
  });
});
