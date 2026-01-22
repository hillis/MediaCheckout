/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.google.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'www.bhphotovideo.com' },
      { protocol: 'https', hostname: 'static.bhphoto.com' },
    ],
  },
}
module.exports = nextConfig
