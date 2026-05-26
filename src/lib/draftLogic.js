export function getPickTeamIndex(pickNumber, managerCount, snake = true) {
  const zeroPick = pickNumber - 1;
  const round = Math.floor(zeroPick / managerCount);
  const positionInRound = zeroPick % managerCount;
  if (!snake || round % 2 === 0) return positionInRound;
  return managerCount - 1 - positionInRound;
}

export function getBoardPickNumber(round, managerIndex, managerCount, snake = true) {
  if (snake && round % 2 === 0) {
    return (round - 1) * managerCount + (managerCount - managerIndex);
  }
  return (round - 1) * managerCount + managerIndex + 1;
}

export function normalisePosition(position) {
  return position === "Forward" ? "Attacker" : position;
}

export function positionBadge(position) {
  const labels = {
    Goalkeeper: "GK",
    Defender: "DEF",
    Midfielder: "MID",
    Attacker: "ATT",
    Forward: "ATT",
  };
  return labels[position] || position;
}

export function ratingLabel(rating) {
  if (typeof rating === "string") return rating === "OKay" ? "Okay" : rating;
  const labels = {
    1: "Elite",
    2: "Strong",
    3: "Good",
    4: "Okay",
    5: "Below Average",
  };
  return labels[rating] || "Unrated";
}
