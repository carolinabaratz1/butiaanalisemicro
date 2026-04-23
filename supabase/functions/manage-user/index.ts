import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is Gestor
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is Gestor
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerRole || callerRole.role !== "Gestor") {
      return new Response(JSON.stringify({ error: "Apenas Gestores podem gerenciar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, userId, newRole, newStatus, newPassword } = body;

    if (!action || !userId) {
      return new Response(JSON.stringify({ error: "action e userId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change-role") {
      if (!newRole) {
        return new Response(JSON.stringify({ error: "newRole é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ funcao: newRole })
        .eq("id", userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle-status") {
      const targetStatus = newStatus || "Inativo";
      const banned = targetStatus === "Inativo";

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ status: targetStatus })
        .eq("id", userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: banned ? "876600h" : "none",
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, status: targetStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset-password") {
      if (!newPassword || newPassword.length < 8) {
        return new Response(JSON.stringify({ error: "Nova senha deve ter pelo menos 8 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hasLetter = /[A-Za-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
      if (!hasLetter || !hasNumber || !hasSymbol) {
        return new Response(JSON.stringify({ error: "A senha deve conter letras, números e ao menos um símbolo" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (authError) {
        const msg = /weak|pwned|known/i.test(authError.message)
          ? "Senha rejeitada por ser fraca ou estar em vazamentos conhecidos. Escolha uma senha mais forte."
          : authError.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", userId);

      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
