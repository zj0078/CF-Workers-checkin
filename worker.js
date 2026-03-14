let domain = "这里填机场域名";
let user = "这里填邮箱";
let pass = "这里填密码";
let 签到结果;
let BotToken ='';
let ChatID ='';

export default {

 async fetch(request, env, ctx) {
  await initializeVariables(env);
  const url = new URL(request.url);

  if(url.pathname == "/tg") {
   await sendMessage();
  } else if (url.pathname == "/checkin"){
   await checkin();
  }

  return new Response(签到结果, {
   status: 200,
   headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
  });
 },

 async scheduled(controller, env, ctx) {
  console.log('Cron job started');

  try {
   await initializeVariables(env);
   await checkin();
   console.log('Cron job completed successfully');
  } catch (error) {
   console.error('Cron job failed:', error);
   签到结果 = `定时任务执行失败: ${error.message}`;
   await sendMessage(签到结果);
  }
 },
};

async function initializeVariables(env) {

 domain = env.JC || env.DOMAIN || domain;
 user = env.ZH || env.USER || user;
 pass = env.MM || env.PASS || pass;

 if(!domain.includes("//")) domain = `https://${domain}`;

 BotToken = env.TGTOKEN || BotToken;
 ChatID = env.TGID || ChatID;

 签到结果 =
`地址: ${domain.substring(0,9)}****${domain.substring(domain.length-5)}
账号: ${user.substring(0,1)}****${user.substring(user.length-5)}

TG推送: ${ChatID ? `${ChatID.substring(0,1)}****${ChatID.substring(ChatID.length-3)}` : "未启用"}`;
}

async function sendMessage(msg = "") {

 const 账号信息 =
`地址: ${domain}
账号: ${user}`;

 const now = new Date();
 const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
 const formattedTime = beijingTime.toISOString().slice(0,19).replace('T',' ');

 console.log(msg);

 if (BotToken !== '' && ChatID !== '') {

  const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(
   "执行时间: " + formattedTime + "\n" + 账号信息 + "\n\n" + msg
  )}`;

  return fetch(url,{
   method:'get',
   headers:{
    'Accept':'text/html,application/xhtml+xml,application/xml;',
    'User-Agent':'Mozilla/5.0 Chrome/90.0.4430.72'
   }
  });

 } else if (ChatID !== "") {

  const url = `https://api.tg.090227.xyz/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(
   "执行时间: " + formattedTime + "\n" + 账号信息 + "\n\n" + msg
  )}`;

  return fetch(url,{
   method:'get',
   headers:{
    'Accept':'text/html,application/xhtml+xml,application/xml;',
    'User-Agent':'Mozilla/5.0 Chrome/90.0.4430.72'
   }
  });

 }
}

async function checkin(){

 try{

  if (!domain || !user || !pass) {
   throw new Error('必需的配置参数缺失');
  }

  const loginResponse = await fetch(`${domain}/auth/login`,{
   method:'POST',
   headers:{
    'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent':'Mozilla/5.0',
    'Accept':'application/json, text/plain, */*',
    'Origin':domain,
    'Referer':`${domain}/auth/login`,
   },
   body:new URLSearchParams({
    email:user,
    passwd:pass,
    remember_me:'on',
    code:''
   }).toString()
  });

  if (!loginResponse.ok) {
   const errorText = await loginResponse.text();
   throw new Error(`登录请求失败: ${errorText}`);
  }

  const loginJson = await loginResponse.json();

  if (loginJson.ret !== 1) {
   throw new Error(`登录失败: ${loginJson.msg || '未知错误'}`);
  }

  const cookieHeader = loginResponse.headers.get('set-cookie');

  if (!cookieHeader) {
   throw new Error('登录成功但未收到Cookie');
  }

  const cookies = cookieHeader.split(';')[0];

  await new Promise(resolve => setTimeout(resolve,1000));

  const checkinResponse = await fetch(`${domain}/user/checkin`,{
   method:'POST',
   headers:{
    'Cookie':cookies,
    'User-Agent':'Mozilla/5.0',
    'Accept':'application/json, text/plain, */*',
    'Origin':domain,
    'Referer':`${domain}/user/panel`,
    'X-Requested-With':'XMLHttpRequest'
   }
  });

  const responseText = await checkinResponse.text();

  try{

   const checkinResult = JSON.parse(responseText);

   if (checkinResult.ret === 1 || checkinResult.ret === 0) {

    签到结果 =
`🎉 签到结果 🎉
${checkinResult.msg || (checkinResult.ret === 1 ? '签到成功' : '签到失败')}`;

   } else {

    签到结果 =
`🎉 签到结果 🎉
${checkinResult.msg || '签到结果未知'}`;

   }

  }catch(e){

   if (responseText.includes('登录')) {
    throw new Error('登录状态无效，请检查Cookie处理');
   }

   throw new Error(`解析签到响应失败: ${e.message}`);
  }

  await sendMessage(签到结果);

  return 签到结果;

 }catch(error){

  console.error('Checkin Error:',error);

  签到结果 = `签到过程发生错误: ${error.message}`;

  await sendMessage(签到结果);

  return 签到结果;
 }
}
