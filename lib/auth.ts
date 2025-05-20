import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { validateUser } from './users'; // Import the validateUser function

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      // The name to display on the sign in form (e.g. "Sign in with...")
      name: 'Credentials',
      // `credentials` is used to generate a form on the sign in page.
      // You can specify which fields should be submitted, by adding keys to the `credentials` object.
      // e.g. domain, username, password, 2FA token, etc.
      // You can pass any HTML attribute to the <input> tag through the object.
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials || !credentials.username || !credentials.password) {
          return null;
        }
        console.log("0E", credentials);
        const user = await validateUser(
          credentials.username as string,
          credentials.password as string
        );

        console.log("A", user);

        if (user) {
          // Any object returned will be saved in `user` property of the JWT
          return user;
        } else {
          // If you return null then an error will be displayed advising the user to check their details.
          return null;

          // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      console.log("B", token, user);
      // Add user data to the token
      if (user) {
        token.id = user.id;
        token.username = (user as any).username; // Cast to any if necessary to access custom properties
        token.displayName = (user as any).displayName;
        token.admin = (user as any).admin;
      }
      return token;
    },
    session({ session, token }) {
      console.log("C", token, session);
      // Add user data to the session from the token
      if (session.user && token.id) {
        (session.user as any).id = token.id;
      }
      if (session.user && token.username) {
        (session.user as any).username = token.username;
      }
      if (session.user && token.displayName) {
        (session.user as any).displayName = token.displayName;
      }
      if (session.user && typeof token.admin === 'boolean') {
        (session.user as any).admin = token.admin;
      }
      return session;
    }
  }
});
