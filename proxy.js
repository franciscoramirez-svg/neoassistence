const https = require("https");
const http = require("http");
const selfsigned = require("selfsigned");

const attrs = [{ name: "commonName", value: "localhost" }];
const pems = selfsigned.generate(attrs, { days: 365 });

const options = {
  key: pems.private,
  cert: pems.cert,
};

const PORT = 4433;

https.createServer(options, (req, res) => {
  const proxyPort = req.url.startsWith("/api/") ? 8000 : 3001;
  const hostname = "127.0.0.1";
  
  const proxyReq = http.request(
    { hostname, port: proxyPort, path: req.url, method: req.method, headers: { ...req.headers, host: hostname + ":" + proxyPort } },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { ...proxyRes.headers, "Access-Control-Allow-Origin": "*" });
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", () => { res.writeHead(502); res.end("Proxy error"); });
  req.pipe(proxyReq);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`HTTPS proxy on https://192.168.1.84:${PORT}`);
});
