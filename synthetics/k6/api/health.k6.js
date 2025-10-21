import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500'], // p95 < 500ms
  },
};

export default function () {
  const base = __ENV.SYNTHETIC_BASE_URL || 'https://michalelena.me';
  const res = http.get(`${base}/api/health`);
  check(res, { 'status is 200': r => r.status === 200 });
  sleep(1);
}
