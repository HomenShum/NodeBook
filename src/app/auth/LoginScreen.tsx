import { useAuth } from "@/app/auth/useAuth";
import PhoneHandoff from "@/app/components/PhoneHandoff/PhoneHandoff";
import { Button } from "@/app/components/UIPrimitives/Button";

export const LoginScreen = () => {
  const auth = useAuth();
  return (
    <main
      aria-labelledby="nodebook-login-title"
      data-testid="nodebook-login"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "12px",
        background: "var(--color-background, #fff)",
        color: "var(--color-foreground, #111)",
      }}
    >
      <h1 id="nodebook-login-title" style={{ margin: 0 }}>NodeBook</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>Your node-native notebook.</p>
      <Button
        aria-label="Sign in to NodeBook"
        disabled={!auth}
        onClick={() => auth?.loginWithRedirect()}
      >
        Sign in
      </Button>
      <PhoneHandoff variant="inline" />
    </main>
  );
};
