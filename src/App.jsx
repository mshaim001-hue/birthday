import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TELEGRAM_GROUP_LINK = "https://t.me/+lR0vxQNzFjBjZmFi";
const BOOKING_LINK =
  "https://www.booking.com/hotel/kz/dobri-dom-v-borovom.ru.html?checkin=2026-08-01&checkout=2026-08-02";
const EVENT_DAYS = "1 августа - 2 августа 2026";
const EVENT_PLACE = "Боровое";
const BIRTHDAY_PERSON = "Максат";
const BIRTHDAY_AGE = 43;
const INVITE_LIFETIME_HOURS = 48;

function getInviteToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite")?.trim() || "";
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
      if (!inviteToken) {
        setError("Ссылка приглашения неполная. Проверьте, что в ссылке есть параметр invite.");
        setLoading(false);
        return;
      }

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

      if (!data) {
        setError("Приглашение не найдено. Проверьте ссылку.");
        setLoading(false);
        return;
      }

      let activeInvite = data;
      if (!data.first_opened_at) {
        const expiresAt = new Date(Date.now() + INVITE_LIFETIME_HOURS * 60 * 60 * 1000).toISOString();
        const { data: updatedInvite, error: updateError } = await supabase
          .from("invites")
          .update({
            first_opened_at: nowIso,
            expires_at: expiresAt
          })
          .eq("id", data.id)
          .select("id, token, first_opened_at, expires_at")
          .single();

        if (updateError) {
          setError("Не удалось активировать приглашение. Попробуйте позже.");
          setLoading(false);
          return;
        }
        activeInvite = updatedInvite;
      }

      if (new Date(activeInvite.expires_at).getTime() < Date.now()) {
        setError("Срок действия приглашения истёк.");
      } else {
        setInvite(activeInvite);
      }

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
      setError("Не удалось сохранить ответ. Попробуйте ещё раз.");
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

        <p className="meta">
          Подробнее о домике:{" "}
          <a href={BOOKING_LINK} target="_blank" rel="noreferrer">
            посмотреть описание
          </a>
        </p>

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
            <h3>Отлично, ждём вас!</h3>
            <p>Присоединяйтесь в Telegram-группу, там будет вся организационная информация.</p>
            <a href={TELEGRAM_GROUP_LINK} target="_blank" rel="noreferrer">
              Перейти в Telegram-группу
            </a>
          </div>
        )}

        {result === "no" && (
          <div className="result">
            <h3>Спасибо за ответ</h3>
            <p>Жаль, что не получится. Если планы изменятся, можно открыть приглашение снова и ответить заново.</p>
          </div>
        )}
      </section>
    </main>
  );
}
