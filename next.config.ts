import type { NextConfig } from 'next';
const reviewId=/^[a-f0-9]{8}$/.test(process.env.DEER_REVIEW_ID||'')?process.env.DEER_REVIEW_ID:'next';
const config: NextConfig = { poweredByHeader: false, reactStrictMode: true, distDir:process.env.DEER_INTERFACE_REVIEW==='1'?`.deer-build/interface-${reviewId}`:'.next' };
export default config;
