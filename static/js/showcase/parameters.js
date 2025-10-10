// Parameter-related utility helpers extracted from showcase.js to support modularization.

export function cloneParameterDefault(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneParameterDefault(item));
  }
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach((key) => {
      copy[key] = cloneParameterDefault(value[key]);
    });
    return copy;
  }
  return value;
}

export function getSchemaDefaultValue(schema) {
  if (!schema) return undefined;
  if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
    return schema.default;
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    return schema.const;
  }
  if (Array.isArray(schema.enum) && schema.enum.length === 1) {
    return schema.enum[0];
  }
  return undefined;
}

export function ensureParameterDefaults(submitParams, store) {
  if (!submitParams || !submitParams.properties || !store) return;
  Object.entries(submitParams.properties).forEach(([key, schema]) => {
    const defaultValue = getSchemaDefaultValue(schema);
    if (defaultValue === undefined) {
      return;
    }
    const current = store[key];
    if (current === undefined || current === null || (typeof current === 'string' && current === '')) {
      store[key] = cloneParameterDefault(defaultValue);
    }
  });
}
