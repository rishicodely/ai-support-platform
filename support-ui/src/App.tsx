import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  category: string | null;
  aiConfidence: number | null;
};

function getStatusColor(status: string) {
  if (status === "CLASSIFIED") return "bg-green-500 text-black";
  if (status === "PROCESSING") return "bg-yellow-400 text-black";
  return "bg-red-500 text-white";
}

function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("ALL");

  const fetchTickets = async () => {
    const url =
      status === "ALL"
        ? "http://localhost:3002/tickets"
        : `http://localhost:3002/tickets?status=${status}`;
    const res = await fetch(url);
    const data = await res.json();
    setTickets(data);
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 3000);
    return () => clearInterval(interval);
  }, [status]);

  const createTicket = async () => {
    if (!subject.trim()) return;

    try {
      setLoading(true);

      await fetch("http://localhost:3002/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          priority: "HIGH",
        }),
      });

      setSubject("");

      fetchTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-8">
      <h1 className="text-2xl font-semibold mb-6">AI Support Dashboard</h1>

      {/* ✅ FORM */}
      <div className="mb-6 flex gap-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Describe the issue..."
          className="flex-1 px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={createTicket}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {["ALL", "PROCESSING", "CLASSIFIED", "FAILED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-md text-sm ${
              status === s ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ✅ TABLE */}
      <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg">
        <table className="w-full">
          <thead className="bg-black/40 text-gray-400 text-sm">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Subject</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Confidence</th>
            </tr>
          </thead>

          <tbody>
            {tickets.map((t) => (
              <tr
                key={t.id}
                className="border-t border-slate-700 hover:bg-slate-700/30 transition"
              >
                <td className="p-3">{t.id.slice(0, 8)}</td>
                <td className="p-3">{t.subject}</td>

                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-md text-sm font-medium ${getStatusColor(
                      t.status,
                    )}`}
                  >
                    {t.status}
                  </span>
                </td>

                <td className="p-3">{t.category || "-"}</td>

                <td className="p-3">
                  {t.aiConfidence
                    ? `${(t.aiConfidence * 100).toFixed(0)}%`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
