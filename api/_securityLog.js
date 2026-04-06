function maskValue(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }

  if (text.length <= 6) {
    return `${text.slice(0, 2)}***`;
  }

  return `${text.slice(0, 3)}***${text.slice(-2)}`;
}

function logSecurityEvent(level, event, details = {}) {
  const payload = {
    scope: "matpick-security",
    event,
    details,
    timestamp: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

module.exports = {
  logSecurityEvent,
  maskValue,
};
