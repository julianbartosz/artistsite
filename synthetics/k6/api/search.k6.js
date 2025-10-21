import http from 'k6/http';
import { check } from 'k6';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const base = __ENV.SYNTHETIC_BASE_URL || 'https://michalelena.me';
  const url = `${base}/api/search?q=art`;
  const res = http.get(url);
  check(res, {
    'status 200': r => r.status === 200,
    'json array': r => {
      try { const j = r.json(); return Array.isArray(j) || typeof j === 'object'; }
      catch { return false; }
    },
  });
}
