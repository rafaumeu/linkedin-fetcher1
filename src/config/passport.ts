import passport from 'passport';
import type { Profile } from 'passport';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { environment } from './environment';

const clientID = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const callbackURL = process.env.LINKEDIN_REDIRECT_URI;

console.log("Client ID:", clientID);
console.log("Client Secret:", clientSecret);
console.log("Callback URL:", callbackURL);

if (!clientID || !clientSecret || !callbackURL) {
  throw new Error("As variáveis de ambiente LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET e LINKEDIN_REDIRECT_URI devem estar definidas.");
}

passport.use(new LinkedInStrategy({
    clientID: environment.linkedIn.clientId,
    clientSecret: environment.linkedIn.clientSecret,
    callbackURL: environment.linkedIn.redirectUri,
    scope: ['openid', 'profile', 'email', 'r_events', 'w_member_social', 'rw_events'],
  },
  async (_accessToken: string, _refreshToken: string, profile: Profile, done: (error: Error | null, user?: Profile | false) => void) => {
    // Aqui você pode salvar o perfil do usuário no banco de dados ou fazer outras operações
    return done(null, profile);
  }
)); 