import { useEffect, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";
import { paymentApi } from "../lib/api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { pesewas, NETWORKS } from "../lib/format.js";
import { IconCrown, IconShield } from "../components/Icons.jsx";

export default function Premium() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [provider, setProvider] = useState("mock");
  const [currency, setCurrency] = useState("GHS");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [phone, setPhone] = useState(user?.phone || "");
  const [network, setNetwork] = useState("mtn");
  const [stage, setStage] = useState("idle"); // idle | pending | success | failed
  const [payment, setPayment] = useState(null);
  const pollRef = useRef(null);

  const load = async () => {
    try {
      const [planData, historyData] = await Promise.all([paymentApi.plans(), paymentApi.history()]);
      setPlans(planData.plans || []);
      setProvider(planData.provider || "mock");
      setCurrency(planData.currency || "GHS");
      setHistory(historyData.transactions || []);
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const pay = async () => {
    if (!selected) return;
    setStage("pending");
    setPayment(null);

    try {
      const data = await paymentApi.initiate({ planCode: selected.code, phone, network });
      setPayment(data);

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const status = await paymentApi.check(data.reference);
          setPayment((current) => ({ ...current, ...status }));

          if (status.status === "SUCCESS") {
            stopPolling();
            setStage("success");
            await refresh();
            toast.success(`${selected.name} is active. Enjoy 💜`);
          }
          if (status.status === "FAILED") {
            stopPolling();
            setStage("failed");
          }
          if (attempts > 40) {
            stopPolling();
            setStage("timeout");
          }
        } catch (error) {
          /* keep polling through transient network errors */
        }
      }, 3000);
    } catch (error) {
      setStage("failed");
      setPayment({ instructions: null });
      toast.error(error.message);
    }
  };

  const closeCheckout = () => {
    stopPolling();
    setStage("idle");
    setSelected(null);
    setPayment(null);
  };

  const activePlan = user?.isPremium;

  return (
    <>
      <div className="center" style={{ marginBottom: 20 }}>
        <IconCrown width={34} height={34} />
        <h2 style={{ margin: "10px 0 4px", fontSize: "1.5rem" }}>natthesisa plans</h2>
        <p className="muted small mb-0">
          Pay with MTN MoMo, Vodafone Cash or AirtelTigo Money. No card, no dollars, no stress.
        </p>
      </div>

      {activePlan && (
        <div className="notice" style={{ marginBottom: 16, borderColor: "rgba(245,158,11,.4)" }}>
          👑 You are premium until{" "}
          <strong>{new Date(user.premiumUntil).toLocaleDateString()}</strong>. Buying another plan
          extends it.
        </div>
      )}

      <div className="stack">
        {plans.map((plan) => (
          <div className={`plan-card ${plan.popular ? "popular" : ""}`} key={plan.id}>
            {plan.popular && <span className="pill pill-gold ribbon">Most popular</span>}

            <div className="row-between">
              <div>
                <h3 style={{ margin: 0 }}>{plan.name}</h3>
                <div className="tiny muted">{plan.tagline}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="price">{pesewas(plan.pricePesewas, currency)}</div>
                <div className="tiny muted">{plan.durationDays} day{plan.durationDays > 1 ? "s" : ""}</div>
              </div>
            </div>

            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button className={`btn ${plan.popular ? "btn-primary" : ""} btn-block`} onClick={() => setSelected(plan)}>
              {activePlan ? "Extend with this plan" : `Get ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <IconShield width={16} height={16} /> Payments are handled by{" "}
        <strong>{provider === "mock" ? "the sandbox provider (no real money)" : provider}</strong>. In
        production this is Hubtel Ghana or Paystack Ghana - you only change one environment variable.
      </div>

      {!!history.length && (
        <>
          <hr />
          <h4>Payment history</h4>
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((tx) => (
                <tr key={tx.reference}>
                  <td>{tx.plan.name}</td>
                  <td>{pesewas(tx.amountPesewas, tx.currency)}</td>
                  <td>
                    <span
                      className={`pill ${
                        tx.status === "SUCCESS" ? "pill-ok" : tx.status === "FAILED" ? "pill-danger" : ""
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                  <td className="tiny muted">{new Date(tx.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ------------------------------ checkout ------------------------------ */}
      {selected && (
      <Modal title={`${selected.name} · ${pesewas(selected.pricePesewas, currency)}`} onClose={closeCheckout}>
        {stage === "idle" ? (
          <div className="stack">
            <div className="field">
              <label>Mobile money number</label>
              <input
                className="input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0241234567"
              />
            </div>

            <div className="field">
              <label>Network</label>
              <div className="network-picker">
                {NETWORKS.map((option) => (
                  <button
                    key={option.id}
                    className={network === option.id ? "active" : ""}
                    onClick={() => setNetwork(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-block btn-lg" onClick={pay}>
              Pay {pesewas(selected.pricePesewas, currency)}
            </button>
            <p className="tiny muted center mb-0">
              You will get a prompt on your phone to approve with your MoMo PIN.
            </p>
          </div>
        ) : (
          <div className="pending-pay">
            {stage === "pending" && (
              <>
                <div className="spinner" />
                <h3>Waiting for your approval</h3>
                <p className="muted small">{payment?.instructions}</p>
                <p className="tiny muted">
                  {payment?.reference} · {payment?.phone}
                </p>
                {provider === "mock" && (
                  <button
                    className="btn btn-soft btn-sm"
                    onClick={async () => {
                      await paymentApi.simulate(payment.reference, "SUCCESS");
                      const status = await paymentApi.check(payment.reference);
                      setPayment(status);
                      stopPolling();
                      setStage("success");
                      await refresh();
                      toast.success("Payment approved (sandbox)");
                    }}
                  >
                    Approve in sandbox
                  </button>
                )}
              </>
            )}

            {stage === "success" && (
              <>
                <div style={{ fontSize: "2.6rem" }}>🎉</div>
                <h3>Payment confirmed</h3>
                <p className="muted small">
                  {selected.name} is active on your account. Go and make it count.
                </p>
                <div className="row" style={{ justifyContent: "center" }}>
                  <button className="btn btn-primary" onClick={closeCheckout}>
                    Start swiping
                  </button>
                </div>
              </>
            )}

            {(stage === "failed" || stage === "timeout") && (
              <>
                <div style={{ fontSize: "2.6rem" }}>😕</div>
                <h3>{stage === "timeout" ? "Still waiting" : "Payment not completed"}</h3>
                <p className="muted small">
                  {payment?.failureReason ||
                    (stage === "timeout"
                      ? "We have not received confirmation yet. If you approved it, your plan will activate automatically."
                      : "The provider could not complete the request. Check your MoMo balance and try again.")}
                </p>
                <div className="row" style={{ justifyContent: "center" }}>
                  <button className="btn" onClick={() => setStage("idle")}>
                    Try again
                  </button>
                  <button className="btn btn-ghost" onClick={closeCheckout}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      )}
    </>
  );
}
