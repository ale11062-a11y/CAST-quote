import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AdminUser = {
  id: string;
  email: string;
  role: "dev" | "empresa" | "tecnico";
  company_id: string | null;
};

async function getCaller(supabase: any, token: string): Promise<AdminUser | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return null;
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, role, company_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileErr || !profile) return null;
  return profile as AdminUser;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = req.method === "POST" || req.method === "PUT"
      ? await req.json().catch(() => ({}))
      : {};

    // Bootstrap the first DEV account. Only works when no DEV exists yet.
    // Handled BEFORE auth because there is no one to log in as.
    if (action === "bootstrap-dev" && req.method === "POST") {
      const { email, password } = body as { email: string; password: string };
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existingDevs, error: devErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "dev")
        .limit(1);
      if (devErr) {
        return new Response(JSON.stringify({ error: devErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existingDevs && existingDevs.length > 0) {
        return new Response(JSON.stringify({ error: "Já existe um usuário DEV. Use o login normal." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (userErr || !newUser?.user) {
        return new Response(JSON.stringify({ error: "Falha ao criar DEV: " + (userErr?.message || "") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({ id: newUser.user.id, email, role: "dev", company_id: null });
      if (profileErr) {
        await supabase.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: "Falha ao criar perfil DEV: " + profileErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, user_id: newUser.user.id }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require an authenticated DEV.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const caller = await getCaller(supabase, token);

    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const devOnly = ["create-company", "toggle-company", "toggle-technician", "reset-password", "delete-company"];
    if (devOnly.includes(action || "") && caller.role !== "dev") {
      return new Response(JSON.stringify({ error: "Acesso restrito ao DEV." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block writes from inactive-company users (empresa/tecnico). DEV is exempt.
    if (caller.role !== "dev" && caller.company_id) {
      const { data: comp } = await supabase
        .from("companies")
        .select("active")
        .eq("id", caller.company_id)
        .maybeSingle();
      if (!comp || !comp.active) {
        return new Response(JSON.stringify({ error: "Empresa inativa. Contate o administrador." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create a technician linked to the caller's company (EMPRESA only)
    if (action === "create-technician" && req.method === "POST") {
      if (caller.role !== "empresa" || !caller.company_id) {
        return new Response(JSON.stringify({ error: "Apenas a empresa pode cadastrar técnicos." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { email, password, name } = body as { email: string; password: string; name?: string };
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || "" },
      });
      if (userErr || !newUser?.user) {
        return new Response(JSON.stringify({ error: "Falha ao criar técnico: " + (userErr?.message || "") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({ id: newUser.user.id, email, role: "tecnico", company_id: caller.company_id, name: name || null });
      if (profileErr) {
        await supabase.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: "Falha ao criar perfil do técnico: " + profileErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ user_id: newUser.user.id }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete a technician (EMPRESA, scoped to own company)
    if (action === "delete-technician" && req.method === "POST") {
      if (caller.role !== "empresa" || !caller.company_id) {
        return new Response(JSON.stringify({ error: "Acesso negado." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id } = body as { user_id: string };
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: target } = await supabase
        .from("profiles")
        .select("id, role, company_id")
        .eq("id", user_id)
        .maybeSingle();
      if (!target || target.role !== "tecnico" || target.company_id !== caller.company_id) {
        return new Response(JSON.stringify({ error: "Técnico não encontrado na sua empresa." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: delErr } = await supabase.auth.admin.deleteUser(user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset a technician's password (EMPRESA, scoped to own company)
    if (action === "reset-technician-password" && req.method === "POST") {
      if (caller.role !== "empresa" || !caller.company_id) {
        return new Response(JSON.stringify({ error: "Acesso negado." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id, new_password } = body as { user_id: string; new_password: string };
      if (!user_id || !new_password) {
        return new Response(JSON.stringify({ error: "user_id e new_password são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: target } = await supabase
        .from("profiles")
        .select("id, role, company_id")
        .eq("id", user_id)
        .maybeSingle();
      if (!target || target.role !== "tecnico" || target.company_id !== caller.company_id) {
        return new Response(JSON.stringify({ error: "Técnico não encontrado na sua empresa." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a new company + its EMPRESA login
    if (action === "create-company" && req.method === "POST") {
      const { name, email, password, primary_color, logo_url } = body as {
        name: string; email: string; password: string;
        primary_color?: string; logo_url?: string;
      };
      if (!name || !email || !password) {
        return new Response(JSON.stringify({ error: "Nome, e-mail e senha são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Create the company row
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({
          name,
          primary_color: primary_color || "#2563eb",
          logo_url: logo_url || null,
          active: true,
        })
        .select()
        .single();
      if (companyErr || !company) {
        return new Response(JSON.stringify({ error: "Falha ao criar empresa: " + (companyErr?.message || "") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Create the auth user for the company login
      const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (userErr || !newUser?.user) {
        // rollback company
        await supabase.from("companies").delete().eq("id", company.id);
        return new Response(JSON.stringify({ error: "Falha ao criar usuário: " + (userErr?.message || "") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Create the profile linked to the company
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({
          id: newUser.user.id,
          email,
          role: "empresa",
          company_id: company.id,
        });
      if (profileErr) {
        await supabase.auth.admin.deleteUser(newUser.user.id);
        await supabase.from("companies").delete().eq("id", company.id);
        return new Response(JSON.stringify({ error: "Falha ao criar perfil: " + profileErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ company_id: company.id, user_id: newUser.user.id }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Toggle company active state
    if (action === "toggle-company" && req.method === "POST") {
      const { company_id, active } = body as { company_id: string; active: boolean };
      if (!company_id) {
        return new Response(JSON.stringify({ error: "company_id é obrigatório." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("companies")
        .update({ active })
        .eq("id", company_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset a company user's password
    if (action === "reset-password" && req.method === "POST") {
      const { user_id, new_password } = body as { user_id: string; new_password: string };
      if (!user_id || !new_password) {
        return new Response(JSON.stringify({ error: "user_id e new_password são obrigatórios." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Toggle a technician's active state (DEV only)
    if (action === "toggle-technician" && req.method === "POST") {
      const { user_id, active } = body as { user_id: string; active: boolean };
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: target } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user_id)
        .maybeSingle();
      if (!target || target.role !== "tecnico") {
        return new Response(JSON.stringify({ error: "Técnico não encontrado." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase
        .from("profiles")
        .update({ active })
        .eq("id", user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete a company and its auth user
    if (action === "delete-company" && req.method === "POST") {
      const { company_id } = body as { company_id: string };
      if (!company_id) {
        return new Response(JSON.stringify({ error: "company_id é obrigatório." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Find the linked profile (empresa user) before deleting
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", company_id)
        .maybeSingle();
      // Delete the auth user (cascades to profile via FK)
      if (prof?.id) {
        await supabase.auth.admin.deleteUser(prof.id);
      }
      // Delete the company row (cascades to budgets + budget_items)
      const { error: delErr } = await supabase
        .from("companies")
        .delete()
        .eq("id", company_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida." }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
