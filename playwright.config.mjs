import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'interface.spec.mjs',timeout:60000,workers:1,reporter:'list',outputDir:'.deer-build/playwright',use:{channel:'chrome',headless:true,baseURL:'http://127.0.0.1:3011',viewport:{width:1440,height:1000}}});
