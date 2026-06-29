const BASE = 'https://statsapi.mlb.com/api/v1';

async function fetchJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MLB API failed ${res.status}: ${body}`);
  }

  return res.json();
}

export async function getBoxscore(gamePk) {
  return fetchJson(`${BASE}/game/${gamePk}/boxscore`);
}

export async function getGameFeed(gamePk) {
  return fetchJson(`${BASE}/game/${gamePk}/feed/live`);
}

export function getBattingStats(boxscore, playerId) {
  const id = `ID${playerId}`;
  const away = boxscore?.teams?.away?.players || {};
  const home = boxscore?.teams?.home?.players || {};
  const player = away[id] || home[id];

  return player?.stats?.batting || {};
}

export function getPlayerSide(boxscore, playerId) {
  const id = `ID${playerId}`;
  if (boxscore?.teams?.away?.players?.[id]) return 'away';
  if (boxscore?.teams?.home?.players?.[id]) return 'home';
  return null;
}

export function getGameLabel(boxscore) {
  const away = boxscore?.teams?.away?.team?.abbreviation || boxscore?.teams?.away?.team?.name || 'Away';
  const home = boxscore?.teams?.home?.team?.abbreviation || boxscore?.teams?.home?.team?.name || 'Home';
  return `${away} @ ${home}`;
}

export async function getHomeRunDetails(gamePk, playerId) {
  const feed = await getGameFeed(gamePk);
  const plays = feed?.liveData?.plays?.allPlays || [];

  return plays
    .filter(play => {
      const batterId = play?.matchup?.batter?.id;
      const event = play?.result?.event || '';
      return batterId === Number(playerId) && event.toLowerCase().includes('home run');
    })
    .map(play => ({
      inning: play?.about?.inning,
      half: play?.about?.halfInning,
      description: play?.result?.description || 'Home run'
    }));
}
