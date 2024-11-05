import _ from 'lodash';
import * as chromeUtil from './utils/chrome';
import {auto, AutoConfiguration, gist} from './utils/store';

const DEBOUNCE_DELAY = 10000;

/* tslint:disable no-console */

// Auto Merge
chrome.windows.onCreated.addListener(async () => {
  console.log('Automatic merger operation');
  const list = (await filterDomain('autoMerge')).map(([domain]) => domain);
  if (list.length === 0) {
    console.log('There is no domain name that requires automatic merging');
    return;
  }
  console.log(`common${list.length}Individual domain names need to be automatically merged：${list.join(',')}`);
  let done = 0;
  for (const domain of list) {
    const cookies = await gist.getCookies(domain);
    await chromeUtil.importCookies(cookies);
    done++;
    console.log(`[${done}/${list.length}] ${domain}of${cookies.length}Cookie has been merged`);
  }
  if (done) {
    badge(`↓${done}`);
  }
});

// Auto Push
chrome.cookies.onChanged.addListener(_.debounce(async () => {
  try {
    console.log('Automatic push operation');
    const list = await filterDomain('autoPush');
    if (list.length === 0) {
      console.log('There is no domain name that needs to be pushed automatically');
      return;
    }
    console.log(list);
    console.log(`${list.length}Individual domain names need to be pushed automatically:${list.map(([domain]) => domain).join(',')}`);
    const bulk: Array<{domain: string, cookies: chrome.cookies.SetDetails[]}> = [];
    for (const [domain, config] of list) {
      console.log(`Treating domain name${domain}`);
      const newCookies = await chromeUtil.exportCookies(domain);
      const oldCookies = await gist.getCookies(domain);
      let rules: string[];
      if (config.autoPushName.length === 0) {
        console.log('The domain name is not configured to automatically push the rules, and the name of all the cookie that has been saved as the default is the rule');
        rules = _.uniq(oldCookies.map((cookie) => cookie.name as string));
      } else {
        console.log(`Automatically push the name rule：${config.autoPushName.join(',')}`);
        rules = config.autoPushName;
      }

      const oldCookiesFiltered = oldCookies.filter((cookie) => rules.includes(cookie.name as string));
      const newCookiesFiltered = newCookies.filter((cookie) => rules.includes(cookie.name as string));
      // 数量测试，两者的数量必须相同
      console.log('The quantity test, the number of the two must be the same');
      console.log(`Name filter, the old common together：${oldCookiesFiltered.length}A new communist：${newCookiesFiltered.length}个`);
      if (oldCookiesFiltered.length !== newCookiesFiltered.length) {
        console.log(`The quantity test is not approved, you need to push it`);
        bulk.push({domain, cookies: newCookies});
        continue;
      }
      console.log('Quantity test pass');

      // 将 Cookie 数组转为 url##name => value, expirationDate 的 Object
      console.log('Will Cookie Array turned url##name => value, expirationDate of Object');
      const oldProcessed = _.mapValues(
        _.keyBy(oldCookiesFiltered, (cookie) => `${cookie.url}##${cookie.name}`),
        (cookie) => _.pick(cookie, ['value', 'expirationDate']),
      );
      const newProcessed = _.mapValues(
        _.keyBy(newCookiesFiltered, (cookie) => `${cookie.url}##${cookie.name}`),
        (cookie) => _.pick(cookie, ['value', 'expirationDate']),
      );
      console.log('After the old processing', oldProcessed);
      console.log('New processing', newProcessed);

      // Key 测试，两者的 Key 组成必须完全相同
      console.log('Key 测试，两者的 Key 组成必须完全相同');
      if (!_.isEqual(Object.keys(oldProcessed).sort(), Object.keys(newProcessed).sort())) {
        console.log('Key 测试不通过，需要推送');
        bulk.push({domain, cookies: newCookies});
        continue;
      }

      // 逐个测试，对应 value 必须相等，旧的过期剩余时间比新的过期剩余时间不能少于50%
      console.log('Key Test');
      console.log('Testing one by one, corresponding to the value must be equal, the old expires remain than 50% than the new expires and the remaining time.');
      for (const key of Object.keys(oldProcessed)) {
        const oldOne = oldProcessed[key];
        const newOne = newProcessed[key];
        if (oldOne.value !== newOne.value) {
          console.log(`${key}The corresponding value is inconsistent and needs to be pushed`);
          bulk.push({domain, cookies: newCookies});
          break;
        }
        const now = new Date().getTime() / 1000;
        const oldRemain = oldOne.expirationDate as number - now;
        const newRemain = newOne.expirationDate as number - now;
        if (oldRemain < newRemain * 0.5) {
          console.log(`Old ones${oldRemain}Expire in seconds`);
          console.log(`New ones${newRemain}Expire in seconds`);
          console.log(`${oldRemain} / ${newRemain} = ${oldRemain / newRemain} < 0.5`);
          console.log("Too old, don't pass");
          bulk.push({domain, cookies: newCookies});
          break;
        }
      }
      console.log('Test it one by one, no need to push');
    }
    console.log(`common${bulk.length}Individual domain names need push`);
    if (bulk.length) {
      await gist.set(bulk);
      badge(`↑${bulk.length}`, 'green');
    }
  } catch (err) {
    console.error(err);
    badge('err', 'black', 100000);
  }
}, DEBOUNCE_DELAY));

function badge(text: string, color: string = 'red', delay: number = 10000) {
  chrome.browserAction.setBadgeText({text});
  chrome.browserAction.setBadgeBackgroundColor({color});
  setTimeout(() => {
    chrome.browserAction.setBadgeText({text: ''});
  }, delay);
}

async function filterDomain(type: 'autoPush' | 'autoMerge'): Promise<Array<[string, AutoConfiguration]>> {
  let list: Array<[string, AutoConfiguration]>;
  if (type === 'autoPush') {
    list = await auto.getAutoPush();
  } else {
    list = await auto.getAutoMerge();
  }
  if (list.length) {
    const ready = await gist.init();
    if (!ready) {
      return [];
    }
  }
  return list;
}
