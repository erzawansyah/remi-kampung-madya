import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
// Reels: kualitas tinggi supaya teks dan kartu tetap tajam sesudah dikompres ulang Instagram.
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
// Chromium bawaan lingkungan (kalau ada); kalau tidak, Remotion mengunduh Chrome Headless Shell sendiri.
if (process.env.CHROME_PATH) Config.setBrowserExecutable(process.env.CHROME_PATH);
