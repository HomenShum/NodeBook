import { useAuth } from "@/app/auth/useAuth";
import { Button } from "@/app/components/UIPrimitives/Button";

export const LoginScreen = () => {
  const { loginWithRedirect } = useAuth();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <h1>Login</h1>
      <Button onClick={() => loginWithRedirect()}>Log in</Button>
    </div>
  );
};
