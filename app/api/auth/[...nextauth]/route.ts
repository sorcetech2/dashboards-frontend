import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { validateUser } from '@/lib/users';
// import { User } from 'next-auth';

export const {
  handlers: { GET, POST }
  // signIn,
  // signOut,
  // auth
} = NextAuth({
  // callbacks: {
  //   async session({ session, user }) {
  //     console.log('callback');
  //     console.log(user);
  //     session.user.id = user.id;
  //     return session;
  //   }
  // },
  providers: [
    Credentials({
      // You can specify which fields should be submitted, by adding keys to the `credentials` object.
      // e.g. domain, username, password, 2FA token, etc.
      credentials: {
        username: {},
        password: {}
      },
      authorize: async (credentials) => {
        let user = null;

        // console.log(credentials);
        // logic to salt and hash password
        // const pwHash = sltAndHashPassword(credentials.password)

        // logic to verify if the user exists
        // user = await getUserFromDb(credentials.email, pwHash)
        user = await validateUser(credentials.username, credentials.password);
        // user = hardcodedUsers.find((value) => {
        //   return (
        //     value.username === credentials.username &&
        //     value.code === credentials.password
        //   );
        // });

        if (!user) {
          // No user found, so this is their first attempt to login
          // meaning this is also the place you could do registration
          throw new Error('User not found.');
        }

        // return user object with their profile data
        return {
          id: user.id,
          name: user.username,
          email: '',
          image: ''
        };
      }
    })
  ]
});
