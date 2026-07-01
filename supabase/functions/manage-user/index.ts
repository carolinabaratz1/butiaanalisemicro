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

    // Check caller role
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    const body = await req.json();
    const { action, userId, newRole, newStatus, newPassword, note } = body;

    // Reset MFA: permitido para Gestor e Risco e Compliance
    const isGestor = callerRole?.role === "Gestor";
    const isRisco = callerRole?.role === "Risco e Compliance";
    const canResetMfa = isGestor || isRisco;

    if (action !== "reset-mfa" && !isGestor) {
      return new Response(JSON.stringify({ error: "Apenas Gestores podem gerenciar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset-mfa" && !canResetMfa) {
      return new Response(JSON.stringify({ error: "Apenas Gestor ou Risco e Compliance podem resetar o MFA" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!action || !userId) {
      return new Response(JSON.stringify({ error: "action e userId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change-role") {
      const VALID_ROLES = ["Gestor", "Coordenação/Especialista", "Analista", "Risco e Compliance", "Consulta"];
      if (!newRole || !VALID_ROLES.includes(newRole)) {
        return new Response(JSON.stringify({ error: "Função inválida" }), {
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

    if (action === "reset-mfa") {
      // Lista fatores do usuário
      const { data: factorsData, error: listErr } = await adminClient.auth.admin.mfa.listFactors({ userId });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const factors = factorsData?.factors ?? [];
      let removed = 0;
      for (const f of factors) {
        const { error: delErr } = await adminClient.auth.admin.mfa.deleteFactor({ userId, id: f.id });
        if (!delErr) removed++;
      }

      // Busca dados para auditoria
      const { data: targetProfile } = await adminClient
        .from("profiles").select("nome, email").eq("id", userId).single();
      const { data: callerProfile } = await adminClient
        .from("profiles").select("nome, email").eq("id", caller.id).single();

      await adminClient.from("mfa_reset_log").insert({
        target_user_id: userId,
        target_user_email: targetProfile?.email ?? null,
        target_user_nome: targetProfile?.nome ?? null,
        performed_by: caller.id,
        performed_by_email: callerProfile?.email ?? caller.email ?? null,
        performed_by_nome: callerProfile?.nome ?? null,
        factors_removed: removed,
        note: note ?? null,
      });

      return new Response(JSON.stringify({ success: true, factors_removed: removed }), {
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
