import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TELEGRAM_GROUP_LINK = "https://t.me/+lR0vxQNzFjBjZmFi";
const EVENT_DAYS = "1 августа - 2 августа 2026";
const EVENT_PLACE = "Боровое";
const BIRTHDAY_PERSON = "Максат";
const BIRTHDAY_AGE = 43;
const INVITE_LIFETIME_HOURS = 15;

function createToken() {
  return crypto.randomUUID();
}

function getInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const existing = params.get("invite")?.trim();
  if (existing) return existing;

  const generated = createToken();
  params.set("invite", generated);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  return generated;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function App() {
  const [inviteToken] = useState(getInviteToken());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    async function loadInvite() {
      const nowIso = new Date().toISOString();

      const { data, error: inviteError } = await supabase
        .from("invites")
        .select("id, token, first_opened_at, expires_at")
        .eq("token", inviteToken)
        .maybeSingle();

      if (inviteError) {
        setError("Не удалось открыть приглашение. Попробуйте позже.");
        setLoading(false);
        return;
      }

      let activeInvite = data;

      if (!activeInvite) {
        const expiresAt = new Date(Date.now() + INVITE_LIFETIME_HOURS * 60 * 60 * 1000).toISOString();
        const { data: createdInvite, error: createError } = await supabase
          .from("invites")
          .insert({
            token: inviteToken,
            first_opened_at: nowIso,
            expires_at: expiresAt
          })
          .select("id, token, first_opened_at, expires_at")
          .single();

        if (createError) {
          setError("Не удалось создать приглашение. Попробуйте позже.");
          setLoading(false);
          return;
        }
        activeInvite = createdInvite;
      }

      if (!activeInvite.first_opened_at) {
        const expiresAt = new Date(Date.now() + INVITE_LIFETIME_HOURS * 60 * 60 * 1000).toISOString();
        const { data: updatedInvite, error: updateError } = await supabase
          .from("invites")
          .update({
            first_opened_at: nowIso,
            expires_at: expiresAt
          })
          .eq("id", activeInvite.id)
          .select("id, token, first_opened_at, expires_at")
          .single();

        if (updateError) {
          setError("Не удалось активировать приглашение. Попробуйте позже.");
          setLoading(false);
          return;
        }
        activeInvite = updatedInvite;
      }

      const { data: existingResponse, error: responseError } = await supabase
        .from("responses")
        .select("guest_name, attending, auto_declined")
        .eq("invite_id", activeInvite.id)
        .maybeSingle();

      if (responseError) {
        setError("Не удалось получить статус приглашения.");
        setLoading(false);
        return;
      }

      if (existingResponse) {
        setResult(existingResponse.auto_declined ? "auto-no" : existingResponse.attending ? "yes" : "no");
        if (existingResponse.guest_name !== "Не ответил") {
          setName(existingResponse.guest_name);
        }
        setInvite(activeInvite);
        setLoading(false);
        return;
      }

      if (new Date(activeInvite.expires_at).getTime() < Date.now()) {
        const { error: autoDeclineError } = await supabase.from("responses").insert({
          invite_id: activeInvite.id,
          guest_name: "Не ответил",
          attending: false,
          auto_declined: true
        });

        if (autoDeclineError) {
          setError("Срок действия приглашения истек.");
          setLoading(false);
          return;
        }

        setResult("auto-no");
        setInvite(activeInvite);
        setLoading(false);
        return;
      }

      setInvite(activeInvite);
      setLoading(false);
    }

    loadInvite();
  }, [inviteToken]);

  const expiresLabel = useMemo(() => {
    if (!invite?.expires_at) return "";
    return formatDateTime(invite.expires_at);
  }, [invite]);

  async function submitAnswer(attending) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Введите имя, чтобы ответить на приглашение.");
      return;
    }
    if (!invite) return;

    setError("");
    setSubmitting(true);

    const payload = {
      invite_id: invite.id,
      guest_name: trimmedName,
      attending
    };

    const { error: saveError } = await supabase.from("responses").insert(payload);
    if (saveError) {
      setError("Не удалось сохранить ответ. Попробуйте еще раз.");
      setSubmitting(false);
      return;
    }

    setResult(attending ? "yes" : "no");
    setSubmitting(false);
  }

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Приглашение</p>
        <h1>День рождения {BIRTHDAY_PERSON}</h1>
        <p className="lead">
          {BIRTHDAY_PERSON} исполняется {BIRTHDAY_AGE} года. Будем рады провести выходные вместе.
        </p>
        <p className="lead">Пожалуйста, подтвердите участие в течение 15 часов после первого открытия ссылки.</p>

        <div className="info-grid">
          <article className="info-item">
            <h2>Когда</h2>
            <p>{EVENT_DAYS}</p>
          </article>
          <article className="info-item">
            <h2>Где</h2>
            <p>{EVENT_PLACE}, уютный домик у озера</p>
          </article>
        </div>

        <img
          className="hero-image"
          src="https://cf.bstatic.com/xdata/images/hotel/max1024x768/417198523.jpg?k=1f2ac69d9d9e2de0f181db3b6a55dd54d57f038b040f2ddc89c6b8e89bc0f6b5&o="
          alt="Домик в Боровом"
        />

        {invite && (
          <p className="meta">
            Приглашение действует до <strong>{expiresLabel}</strong>.
          </p>
        )}

        {loading ? <p className="status">Загрузка приглашения...</p> : null}
        {error ? <p className="status status-error">{error}</p> : null}

        {!loading && invite && !result && (
          <form
            className="rsvp-form"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <label htmlFor="guestName">Ваше имя</label>
            <input
              id="guestName"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Асхат"
              autoComplete="name"
              maxLength={80}
            />

            <div className="actions">
              <button type="button" onClick={() => submitAnswer(true)} disabled={submitting}>
                {submitting ? "Отправка..." : "Да, я приду"}
              </button>
              <button type="button" className="ghost" onClick={() => submitAnswer(false)} disabled={submitting}>
                Не смогу
              </button>
            </div>
          </form>
        )}

        {result === "yes" && (
          <div className="result success">
            <h3>Отлично, ждем вас!</h3>
            <p>Присоединяйтесь в Telegram-группу, там будет вся организационная информация.</p>
            <a href={TELEGRAM_GROUP_LINK} target="_blank" rel="noreferrer">
              Перейти в Telegram-группу
            </a>
          </div>
        )}

        {result === "no" && (
          <div className="result">
            <h3>Спасибо за ответ</h3>
            <p>Жаль, что не получится. Отказ зафиксирован.</p>
          </div>
        )}

        {result === "auto-no" && (
          <div className="result">
            <h3>Время ответа истекло</h3>
            <p>Прошло более 15 часов с первого открытия, поэтому приглашение автоматически отмечено как отказ.</p>
          </div>
        )}
      </section>
    </main>
  );
}
