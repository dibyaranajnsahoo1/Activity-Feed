const PROD_API_URL = 'https://activity-feed-dfpx.onrender.com';
const PROD_WS_URL = 'wss://activity-feed-dfpx.onrender.com';
const LOCAL_API_URL = 'http://localhost:5000';
const LOCAL_WS_URL = 'ws://localhost:5000';

const stripTrailingSlash = (url) => url.replace(/\/+$/, '');

const isHttpsPage = () =>
  typeof window !== 'undefined' && window.location?.protocol === 'https:';

const normalizeWsUrl = (url) => {
  let nextUrl = stripTrailingSlash(url);

  if (nextUrl.startsWith('https://')) {
    nextUrl = `wss://${nextUrl.slice('https://'.length)}`;
  } else if (nextUrl.startsWith('http://')) {
    nextUrl = `ws://${nextUrl.slice('http://'.length)}`;
  }

  if (isHttpsPage() && nextUrl.startsWith('ws://')) {
    nextUrl = `wss://${nextUrl.slice('ws://'.length)}`;
  }

  return nextUrl;
};

export const API_URL = stripTrailingSlash(
  process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_API_URL_PROD || process.env.REACT_APP_API_URL || PROD_API_URL
    : process.env.REACT_APP_API_URL || process.env.REACT_APP_API_URL_PROD || LOCAL_API_URL
);

export const WS_URL = normalizeWsUrl(
  process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_WS_URL_PROD || process.env.REACT_APP_WS_URL || PROD_WS_URL
    : process.env.REACT_APP_WS_URL || process.env.REACT_APP_WS_URL_PROD || LOCAL_WS_URL
);
