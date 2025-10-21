import http from 'k6/http';
import { check } from 'k6';
export const options = { thresholds: { http_req_duration: ['p(95)<2500'] } };
export default function () {
  const base = __ENV.SYNTHETIC_BASE_URL || 'https://michalelena.me';
  const res = http.get(base + '/shop');
  check(res, { '200 OK': r => r.status === 200 });
}
