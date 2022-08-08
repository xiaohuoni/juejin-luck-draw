import { logger, chalk } from "@umijs/utils";
import https from "https";
import fetch from "node-fetch";
import prompts from "prompts";

const luckNums: any = {};

const sleep = (t: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(t);
    }, t);
  });
};

const checkRepeat = (repeat: boolean, luck: number) => {
  if (repeat) return true;
  if (luckNums[luck]) {
    return false;
  } else {
    luckNums[luck] = luck;
    return true;
  }
};

const filterArray = (data: any[]) => {
  const filterObject: any = {};
  const newData: any[] = [];
  data.forEach((i: any) => {
    if (!filterObject[i?.user_info?.user_id]) {
      newData.push(i);
      filterObject[i?.user_info?.user_id] = true;
    }
  });
  return newData;
};

const luckDraw = (length: number, num: string, repeat: boolean = false) => {
  try {
    const numList = `${num}`.split(",");
    let sum = 0;
    const luckList: number[][] = [];
    numList.forEach((item) => {
      let n = parseInt(item, 10);
      sum = sum + n;
      const lucks: number[] = [];
      if (!repeat && sum > length) {
        logger.error(
          "奖项设置错误: 当前设置奖项总数大于参与人数，请允许重复中奖！"
        );
        process.exit();
      }
      if (n > length) {
        logger.warn(
          "奖项设置错误: 当前设置奖项总数大于参与人数，所有人都中奖了！"
        );
        n = length - 1;
        while (n) {
          lucks.push(n);
          n--;
        }
        // 从 0 计数
        lucks.push(n);
      }
      while (n) {
        const luck = Math.floor(Math.random() * length);
        if (!lucks.includes(luck) && checkRepeat(repeat, luck)) {
          lucks.push(luck);
          n--;
        }
      }
      luckList.push(lucks);
    });
    return luckList;
  } catch (error) {
    logger.error("奖项设置错误，请重试！");
    process.exit();
  }
};

export async function run() {
  logger.info("欢迎试用掘金评论区抽奖系统，现在开始抽奖...");
  const { itemId } = await prompts({
    type: "text",
    name: "itemId",
    message: "请输入关联文章?",
  });
  // 获取到文章数据
  let data: any = [];
  try {
    if (!itemId) {
      throw new Error("请输入关联文章。");
    }
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    let cursor = "0";
    let has_more = true;
    while (has_more) {
      const body = {
        item_id: itemId,
        // item_id: "7127209370013663245",
        item_type: 2,
        cursor,
        // 掘金接口一次最多获取 50 条评论
        limit: 50,
        sort: 0,
        client_type: 2608,
      };

      logger.event(
        `获取掘金文章评论数据：${cursor}~${parseInt(cursor, 10) + 50}`
      );

      const response = await fetch(
        "https://api.juejin.cn/interact_api/v1/comment/list",
        {
          method: "post",
          body: JSON.stringify(body),
          agent,
          headers: { "Content-Type": "application/json" },
        }
      );
      const res = await response.json();

      if (res.err_no !== 0) {
        has_more = false;
        logger.error(res.err_msg);
      } else {
        data = data.concat(res.data);
        cursor = res.cursor;
        has_more = res.has_more;
      }

      logger.event(`预计进度：${cursor}/${res.count}`);

      // 睡一会儿
      await sleep(1000);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    logger.error("获取 juejin 文章数据出错:", error);
    process.exit();
  }
  if (data.length === 0) {
    logger.error("获取 juejin 文章数据出错或评论数为 0");
    process.exit();
  }
  logger.info(`本次抽奖的关联文章是《${itemId}》 共有 ${data.length} 条评论`);

  const { filter } = await prompts({
    type: "toggle",
    name: "filter",
    message: "是否排除重复评论数，即每个朋友仅有一次参与机会，多次评论无效?",
    initial: true,
    active: "是",
    inactive: "否",
  });
  if (filter) {
    // 过滤重复的评论数
    data = filterArray(data);
    logger.event("过滤重复的评论数，删除同一个朋友发布的多条评论...");
    logger.info(`抽奖评论数剩余 ${data.length} 条`);
  }
  const { grade = "" } = await prompts({
    type: "text",
    name: "grade",
    message:
      "请输入本次抽奖设置档次，如仅需抽出 1 人，请输入 1\n如有设置1等奖，2等奖等，请用英文字符逗号隔开\n如 1,3,5 表示抽取 1档1人，2档3人，3档5人",
  });
  let isRepeat = false;
  if (grade.includes(",")) {
    const { repeat } = await prompts({
      type: "toggle",
      name: "repeat",
      message:
        "是否允许重复中奖多个档位奖项，如中过1等奖的人是否允许继续中2等奖?",
      initial: false,
      active: "是",
      inactive: "否",
    });
    isRepeat = repeat;
  }
  logger.ready("正在抽奖中，请稍后...");
  const luskList = luckDraw(data.length, grade, isRepeat);
  luskList.forEach((luck, i) => {
    logger.info(`获得 ${i + 1} 档的人是:`);
    luck.forEach((item: any) => {
      const user = data[item];
      console.log(
        chalk.redBright(user?.user_info?.user_name),
        "-",
        chalk.blue(`https://juejin.cn/user/${user?.user_info.user_id}`)
      );
    });
  });
}
