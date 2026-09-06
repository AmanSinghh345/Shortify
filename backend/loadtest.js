import http from 'k6/http';
import { check } from 'k6';

export const options = {
    vus: 100, // 100 log ek saath aayenge
    duration: '10s',
};

export default function () {
    const url = 'http://localhost:8000/cW7U-vs'; 
    
    
    const params = { redirects: 0 };
    
    const res = http.get(url, params);

    check(res, {
        'status is 302 (Redirect Success)': (r) => r.status === 302,
    });
}