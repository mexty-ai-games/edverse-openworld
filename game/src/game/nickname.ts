// Generated nicknames: "<Adjective> <Animal> <NN>" — the only name other players ever see.
export function makeNickname(adjectives: string[], animals: string[], avoid?: string): string {
  const a = adjectives.length ? adjectives : ["Brave"];
  const b = animals.length ? animals : ["Otter"];
  for (let i = 0; i < 8; i++) {
    const n = Math.floor(Math.random() * 90) + 10;
    const name = a[Math.floor(Math.random() * a.length)] + " " + b[Math.floor(Math.random() * b.length)] + " " + n;
    if (name !== avoid) return name;
  }
  return a[0] + " " + b[0] + " " + (Math.floor(Math.random() * 90) + 10);
}
