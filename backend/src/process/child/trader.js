// 接收一下 instIds , bars , codes , 最后返回出来
// 从数据库中获取历史数据，从service 中获取最近一期的数据，
// 把code跑一下 获取结果，进行操作
// TODO: 平仓似乎没有调研怎么弄

let code = ""
// 先把单产品的做了
let instIds = ""
let bars = "1H"


function getCurrentMinute() {
    const now = new Date();
    return now.getMinutes();
}

process.on('message', async (msg) => {
    if (msg.code) {
        code = msg.code
        instIds = msg.instIds
        bars = msg.bars
    }
})
process.on('exit', () => {
    if (global.intervalId) {
        clearInterval(global.intervalId);
        console.log('定时器已清除');
    }
    // 清理工作
    if (global.intervalId) {
        clearInterval(global.intervalId);
        console.log('定时器已清除');
    }
    process.exit();
    return;
}
);


setInterval(() => {
    if (code && instIds && bars) {
        // 获取当前的一个为你
        try {
            const executeUserCode = new Function('index', 'klineData', 'currentPosition', 'lastTrade', code )
            // 从数据库中获取历史数据 

            //从主进程中获取最后一条的数据合在一起

            // index应该直接就算最后一条即可

            // currentPosition 和lastTrade需要保存好 都往库里存储吧// 直接参照那个交易明细直接存罢 ，（ 加上输出的时间 ，运行的代码名字 ，运行的币种，运行的bar）

            // 执行code 

            // 将返回的结果分类判断 进行各种下单操作，先来进行成发邮件的操作罢

            const result = dynamicFunc(a, b, extra);
            console.log('Result:', result); // 输出: Result: 35
          } catch (error) {
            console.error('Error executing dynamic code:', error);
          }
    }
}, 1000 * 50)

const dbCode = `
  return a + b + extra;
`;

// 当前作用域的变量
const a = 10;
const b = 20;
const extra = 5;

// 创建函数并执行
try {
    const dynamicFunc = new Function('a', 'b', 'extra', dbCode);
    const result = dynamicFunc(a, b, extra);
    console.log('Result:', result); // 输出: Result: 35
} catch (error) {
    console.error('Error executing dynamic code:', error);
}