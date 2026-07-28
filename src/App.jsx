import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TELEGRAM_GROUP_LINK = "https://t.me/+lR0vxQNzFjBjZmFi";
const EVENT_DAYS = "1 августа - 2 августа 2026";
const EVENT_PLACE = "Боровое";
const BIRTHDAY_PERSON = "Максат";
const BIRTHDAY_AGE = 43;
const DEFAULT_HOUSE_IMAGES = ["/images/house-1.jpg", "/images/house-2.jpg"];
const RSVP_DEADLINE = "2026-07-29T13:00:00+05:00";

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
  const [heroImages, setHeroImages] = useState(DEFAULT_HOUSE_IMAGES);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function loadEventContent() {
      const { data, error: contentError } = await supabase
        .from("event_content")
        .select("hero_images")
        .eq("id", 1)
        .maybeSingle();

      if (contentError || !data?.hero_images?.length) return;
      setHeroImages(data.hero_images);
    }

    loadEventContent();
  }, []);

  useEffect(() => {
    async function loadInvite() {
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
        const { data: createdInvite, error: createError } = await supabase
          .from("invites")
          .insert({
            token: inviteToken
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

      if (Date.now() > new Date(RSVP_DEADLINE).getTime()) {
        const { error: autoDeclineError } = await supabase.from("responses").insert({
          invite_id: activeInvite.id,
          guest_name: "Не ответил",
          attending: false,
          auto_declined: true
        });

        if (autoDeclineError) {
          setError("Дедлайн ответа уже прошел.");
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
    return `${formatDateTime(RSVP_DEADLINE)} (Астана)`;
  }, []);

  async function submitAnswer(attending) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Введите имя, чтобы ответить на приглашение.");
      return;
    }
    if (!invite) return;
    if (Date.now() > new Date(RSVP_DEADLINE).getTime()) {
      setError("Уже поздно ответить: дедлайн 29 июля 2026, 13:00 по Астане.");
      return;
    }

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
        <p className="eyebrow">ПРИГЛАШЕНИЕ 🎉</p>
        <h1>День рождения {BIRTHDAY_PERSON} 🥳</h1>
        <p className="lead">
          Вашему другу исполняется {BIRTHDAY_AGE} года. Он будет очень рад провести выходные вместе.
        </p>
        <p className="lead">
          Пожалуйста, подтвердите участие в течение 20 часов после первого открытия ссылки.
        </p>
        <p className="deadline">Ответы принимаются до {expiresLabel}. После этого ответить уже нельзя ⛔</p>

        <div className="info-grid">
          <article className="info-item">
            <h2>📅 Когда</h2>
            <p>{EVENT_DAYS}</p>
          </article>
          <article className="info-item">
            <h2>📍 Где</h2>
            <p>{EVENT_PLACE}, уютный домик у озера</p>
          </article>
        </div>

        <img
          className="hero-image"
          src={heroImages[activeImage]}
          alt="Домик в Боровом"
          onError={() => {
            if (activeImage < heroImages.length - 1) {
              setActiveImage((prev) => prev + 1);
            }
          }}
        />
        {heroImages[1] ? <img className="hero-image secondary" src={heroImages[1]} alt="Еще фото домика" /> : null}

        <p className="meta">Будет тепло, душевно и весело: шашлыки, озеро, разговоры и отдых 😎</p>

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
            <h3>Супер, ждем тебя! 🎈</h3>
            <p>Присоединяйтесь в Telegram-группу, там будет вся организационная информация.</p>
            <a href={TELEGRAM_GROUP_LINK} target="_blank" rel="noreferrer">
              Перейти в Telegram-группу
            </a>
          </div>
        )}

        {result === "no" && (
          <div className="result">
            <h3>Спасибо за ответ 🤝</h3>
            <p>Жаль, что не получится. Отказ зафиксирован.</p>
          </div>
        )}

        {result === "auto-no" && (
          <div className="result">
            <h3>Время ответа истекло ⏰</h3>
            <p>Дедлайн ответа прошел, приглашение автоматически отмечено как отказ.</p>
          </div>
        )}
      </section>
    </main>
  );
}
