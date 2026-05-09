export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  console.log(clientId)
  const redirect = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;
  res.redirect(redirect);
  console.log(redirect)
}