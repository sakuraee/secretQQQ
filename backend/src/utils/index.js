import axios from 'axios';
import CryptoJS from 'crypto-js';
import nodemailer from 'nodemailer';
export const sendSignedRequest  = async (
    method,
    requestPath,
    body,
  )=>{
    // 从环境变量获取API凭证
    const apiKey = process.env.OKX_API_KEY;
    const secretKey = process.env.OKX_SECRET_KEY;
    const passphrase = process.env.OKX_PASSPHRASE;

    if (!apiKey || !secretKey) {
      throw new Error('Missing API credentials in environment variables');
    }

    // 生成时间戳
    const timestamp = new Date().toISOString();

    // 构建签名字符串
    let signString = timestamp + method + requestPath;
    if (body && method === 'POST') {
      signString += JSON.stringify(body);
    }

    // 生成签名
    const signature = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(signString, secretKey),
    );

    // 设置请求头
    const headers = {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    };

    // 发送请求
    try {
      const config = {
        method,
        url: `https://www.okx.com${requestPath}`,
        headers,
      };

      if (body && method === 'POST') {
        config['data'] = body;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(
          `API request failed: ${error.response.status} - ${JSON.stringify(
            error.response.data,
          )}`,
        );
      }
      throw new Error(`API request failed: ${error.message}`);
    }
  }



export const sendEmail = async (emailContent) => {
  // 从环境变量获取邮件服务配置
  const emailService = process.env.EMAIL_SERVICE;
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const targetEmail = process.env.TARGET_EMAIL;
  
  if (!emailService || !emailUser || !emailPass || !targetEmail) {
    throw new Error('Missing email credentials in environment variables');
  }

  // 创建邮件发送器
  let transporter = nodemailer.createTransport({
      host: emailService,
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

  // 设置邮件选项
  let mailOptions = {
    from: emailUser,
    to: targetEmail,
    subject: 'New Email Notification',
    text: emailContent,
  };

  // 发送邮件
  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};
export const makeOrder = async (
  instId,
  money,
  price,
  side, // buy / sell 
  posSide, // long /short
  orderName ,
  leverage = 10, // 默认杠杆倍数为10
) => {
  // 计算下单数量
  const getInstrumentPath = `/api/v5/account/instruments?instType=SWAP`;
  const getInstrument = await sendSignedRequest(
    'GET',
    getInstrumentPath,
  );
  const currentInstrument = getInstrument.data.filter(
    (item) => item.instId === instId,
  )[0];
  const ctVal = currentInstrument.ctVal;
  const lotSz = currentInstrument.lotSz;
  const size =
    Math.round((money * leverage) / (price * parseFloat(ctVal)) / lotSz) *
    lotSz;
  console.log(size);

  const setLeveragePath = `/api/v5/account/set-leverage`;
  const setLeverageBody = {
    mgnMode: 'isolated',
    lever: leverage,
    instId,
    posSide,
  };

  const setLeverageRes = await sendSignedRequest(
    'POST',
    setLeveragePath,
    setLeverageBody,
  );
  console.log(setLeverageRes);
  const body = {
    ordType: 'limit',
    tdMode: 'isolated',
    side,
    sz: size,
    px: price,
    posSide,
    instId: instId,
    clOrdId: (new Date()).getTime() ,
    ccy: 'USDT',
  };
  const requestPath = `/api/v5/trade/order`;
  const res = await sendSignedRequest('POST', requestPath, body);
}