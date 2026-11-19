// ACQ de rendimiento del feed (GET /posts). Corre con los datos que deja
// seedFeedPerf.ts.
//
// Uso:
//   k6 run scripts/perf/feed.k6.js \
//     -e BASE_URL=http://localhost:3000 \
//     -e LOGIN_EMAIL=perf-test-user-0@perf-test.local \
//     -e LOGIN_PASSWORD=perf-test-password-123 \
//     -e COMMUNITY_ID=<id> \
//     -e PANEL_ID=<id> \
//     -e AUTHOR_ID=<id>
//
// El rate limit default del backend es 120 req/min por IP
// (apps/backend/src/common/rateLimits.ts) y se deja intacto: el escenario
// se diseña para quedar por debajo (2 VUs, 1 req/s cada una = 120/min en
// total, con margen porque el login también cuenta contra el mismo límite).

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL;
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD;
const COMMUNITY_ID = __ENV.COMMUNITY_ID;
const PANEL_ID = __ENV.PANEL_ID;
const AUTHOR_ID = __ENV.AUTHOR_ID;

export const options = {
  scenarios: {
    feed_by_community: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'feedByCommunity',
    },
    feed_by_panel: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'feedByPanel',
      startTime: '2m',
    },
  },
  thresholds: {
    // Sin umbral estricto global: acá sirven para que k6 imprima el
    // desglose por tag en el resumen final (comunidad = caso indexado,
    // panel = join con communities sin índice dedicado a panel_id).
    'http_req_duration{feed:communityId}': ['max>=0'],
    'http_req_duration{feed:panelId}': ['max>=0'],
    http_req_failed: ['rate<0.01'],
  },
};

function login() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ identifier: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.json('accessToken');
}

// Recorre el feed entero paginando por cursor, como lo haría el scroll
// infinito del mobile, para los tres sorts.
// (sin URLSearchParams: el runtime JS de k6 -goja- no lo tiene global)
function walkFeed(token, queryParam, queryValue) {
  const headers = { Authorization: `Bearer ${token}` };

  for (const sort of ['hot', 'new', 'top']) {
    let cursor = null;
    for (let page = 0; page < 5; page++) {
      let query = `${queryParam}=${encodeURIComponent(queryValue)}&sort=${sort}&limit=20`;
      if (cursor) query += `&cursor=${encodeURIComponent(cursor)}`;

      const res = http.get(`${BASE_URL}/posts?${query}`, {
        headers,
        tags: { feed: queryParam },
      });
      check(res, {
        'feed 200': (r) => r.status === 200,
        'feed tiene items': (r) => Array.isArray(r.json('items')),
      });

      cursor = res.json('nextCursor');
      if (!cursor) break;

      sleep(1);
    }
  }
}

export function feedByCommunity() {
  const token = login();
  walkFeed(token, 'communityId', COMMUNITY_ID);
  sleep(1);
}

export function feedByPanel() {
  const token = login();
  walkFeed(token, 'panelId', PANEL_ID);
  sleep(1);
}

export function feedByAuthor() {
  const token = login();
  walkFeed(token, 'authorId', AUTHOR_ID);
  sleep(1);
}
