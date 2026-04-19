import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import * as path from "path";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(express.json());

  // OAuth Setup
  const getOAuthClient = (req: express.Request) => {
    let baseUri = process.env.APP_URL;
    if (!baseUri && req.query.origin) {
      baseUri = req.query.origin as string;
    }
    if (!baseUri) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      baseUri = `${protocol}://${host}`;
    }
    
    // Remove trailing slash if any
    baseUri = baseUri.replace(/\/$/, '');
    const redirectUri = `${baseUri}/auth/callback`;
    
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  };

  // 1. Get OAuth Auth URL
  app.get("/api/auth/url", (req, res) => {
    try {
      if (!process.env.GOOGLE_CLIENT_ID) {
         return res.status(500).json({ error: "Missing GOOGLE_CLIENT_ID environment variable. Please setup your API keys." });
      }
      const oauth2Client = getOAuthClient(req);
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      });
      res.json({ url: authUrl });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Handle OAuth Callback
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code } = req.query;
    try {
      const oauth2Client = getOAuthClient(req);
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Sending back access_token securely to the preview iframe
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${tokens.access_token}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error(err);
      res.status(500).send("Authentication failed: " + err.message);
    }
  });

  // 3. Fetch latest emails using access token
  app.get("/api/gmail/fetch", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(401).json({ error: "Missing access token" });

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: token as string });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Fetch latest 5 messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: 'in:inbox'
      });

      const messages = response.data.messages || [];
      const emailContents = [];

      for (const msg of messages) {
        const msgData = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full'
        });

        const ObjectHasData = (payload: any): any => {
           let body = '';
           if (payload?.parts) {
             const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
             if (textPart?.body?.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
             } else {
                // Check deeply nested multipart
                for (const p of payload.parts) {
                   if (p.parts) { return ObjectHasData(p); }
                }
             }
           } else if (payload?.body?.data) {
             body = Buffer.from(payload.body.data, 'base64').toString('utf8');
           }
           return body;
        }

        const headers = msgData.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        
        let body = ObjectHasData(msgData.data.payload);
        
        if (!body) body = "(No Extractable Plain Text Body Found)";

        emailContents.push(`From: ${from}\nSubject: ${subject}\n\n${body}`);
      }

      res.json({ emails: emailContents });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
