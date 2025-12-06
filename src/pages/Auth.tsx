import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";

// Validation schema for auth forms
const authSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate input
      const validationResult = authSchema.safeParse({ email, password });
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      const { email: validatedEmail, password: validatedPassword } = validationResult.data;

      const { error } = await supabase.auth.signUp({
        email: validatedEmail,
        password: validatedPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        // Handle specific auth errors
        if (error.message.includes('already registered')) {
          toast.error('Email already registered', {
            description: 'Please sign in or use a different email.'
          });
        } else if (error.message.includes('Invalid email')) {
          toast.error('Invalid email address', {
            description: 'Please enter a valid email.'
          });
        } else if (error.message.includes('fetch')) {
          toast.error('Connection failed', {
            description: 'Unable to reach authentication service. Please check your connection.'
          });
        } else {
          toast.error('Sign up failed', {
            description: error.message
          });
        }
        return;
      }

      toast.success("Account created successfully!");
      navigate("/");
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error('Unexpected error', {
        description: 'An unexpected error occurred during sign up.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate input
      const validationResult = authSchema.safeParse({ email, password });
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      const { email: validatedEmail, password: validatedPassword } = validationResult.data;

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedEmail,
        password: validatedPassword,
      });

      if (error) {
        // Handle specific auth errors
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid credentials', {
            description: 'Email or password is incorrect.'
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Email not confirmed', {
            description: 'Please check your email and confirm your account.'
          });
        } else if (error.message.includes('fetch')) {
          toast.error('Connection failed', {
            description: 'Unable to reach authentication service. Please check your connection.'
          });
        } else {
          toast.error('Sign in failed', {
            description: error.message
          });
        }
        return;
      }

      toast.success("Signed in successfully!");
      navigate("/");
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error('Unexpected error', {
        description: 'An unexpected error occurred during sign in.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 safe-area-inset">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1 text-center">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-primary rounded-xl flex items-center justify-center glow-primary mx-auto mb-2">
            <span className="text-white font-bold text-xl md:text-2xl">W</span>
          </div>
          <CardTitle className="text-xl md:text-2xl">Welcome to W AI</CardTitle>
          <CardDescription className="text-sm md:text-base">Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin" className="text-sm md:text-base">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm md:text-base">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 text-white" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 text-white" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
