// Generated by CoffeeScript 2.5.1
(function() {
  var ReactorChannel, TRANSPILER_CACHE, _timeouts, declare_components, origin, reactor, reactor_channel, transpile;

  origin = new Date();

  ReactorChannel = class ReactorChannel {
    constructor(url1 = '/__reactor__', retry_interval = 100) {
      this.on = this.on.bind(this);
      this.url = url1;
      this.retry_interval = retry_interval;
      this.online = false;
      this.callbacks = {};
      this.original_retry_interval = this.retry_interval;
    }

    on(event_name, callback) {
      return this.callbacks[event_name] = callback;
    }

    trigger(event_name, ...args) {
      var base;
      return typeof (base = this.callbacks)[event_name] === "function" ? base[event_name](...args) : void 0;
    }

    open() {
      var protocol, ref;
      if (this.retry_interval < 10000) {
        this.retry_interval += 1000;
      }
      if (navigator.onLine) {
        if ((ref = this.websocket) != null) {
          ref.close();
        }
        if (window.location.protocol === 'https:') {
          protocol = 'wss://';
        } else {
          protocol = 'ws://';
        }
        this.websocket = new WebSocket(`${protocol}${window.location.host}${this.url}`);
        this.websocket.onopen = (event) => {
          this.online = true;
          this.trigger('open', event);
          return this.retry_interval = this.original_retry_interval;
        };
        this.websocket.onclose = (event) => {
          this.online = false;
          this.trigger('close', event);
          return setTimeout((() => {
            return this.open();
          }), this.retry_interval || 0);
        };
        return this.websocket.onmessage = (event) => {
          var data;
          data = JSON.parse(event.data);
          return this.trigger('message', data);
        };
      } else {
        return setTimeout((() => {
          return this.open();
        }), this.retry_interval);
      }
    }

    send(command, payload) {
      var data;
      data = {
        command: command,
        payload: payload
      };
      if (this.online) {
        return this.websocket.send(JSON.stringify(data));
      }
    }

    send_join(tag_name, state) {
      console.log('>>> JOIN', tag_name, state);
      return this.send('join', {
        tag_name: tag_name,
        state: state
      });
    }

    send_leave(id) {
      console.log('>>> LEAVE', id);
      return this.send('leave', {
        id: id
      });
    }

    send_user_event(element, name, args) {
      console.log('>>> USER_EVENT', element.tag_name, name, args);
      origin = new Date();
      if (this.online) {
        return this.send('user_event', {
          id: element.id,
          name: name,
          args: args
        });
      }
    }

    reconnect() {
      var ref;
      this.retry_interval = 0;
      return (ref = this.websocket) != null ? ref.close() : void 0;
    }

    close() {
      var ref;
      console.log('CLOSE');
      return (ref = this.websocket) != null ? ref.close() : void 0;
    }

  };

  reactor_channel = new ReactorChannel();

  reactor_channel.on('open', function() {
    var el, i, len, ref, results;
    console.log('ON-LINE');
    ref = document.querySelectorAll('[is]');
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      el = ref[i];
      el.classList.remove('reactor-disconnected');
      results.push(typeof el.connect === "function" ? el.connect() : void 0);
    }
    return results;
  });

  reactor_channel.on('close', function() {
    var el, i, len, ref, results;
    console.log('OFF-LINE');
    ref = document.querySelectorAll('[is]');
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      el = ref[i];
      results.push(el.classList.add('reactor-disconnected'));
    }
    return results;
  });

  reactor_channel.on('message', function({type, id, html_diff, url, component_types}) {
    var el;
    console.log('<<<', type.toUpperCase(), id || url || component_types);
    if (type === 'components') {
      return declare_components(component_types);
    } else if (type === 'redirect') {
      return window.location.assign(url);
    } else if (type === 'push_state') {
      return reactor.push_state(url);
    } else {
      el = document.getElementById(id);
      if (el != null) {
        if (type === 'render') {
          return el.apply_diff(html_diff);
        } else if (type === 'remove') {
          return window.requestAnimationFrame(function() {
            return el.remove();
          });
        }
      }
    }
  });

  TRANSPILER_CACHE = {};

  transpile = function(el) {
    var _delay, _name, attr, cache_key, code, i, j, len, len1, method_args, method_name, modifier, modifiers, name, nu_attr, old_name, ref, replacements, results, start;
    if (el.attributes === void 0) {
      return;
    }
    replacements = [];
    ref = el.attributes;
    for (i = 0, len = ref.length; i < len; i++) {
      attr = ref[i];
      if (attr.name.startsWith('@')) {
        [name, ...modifiers] = attr.name.split('.');
        start = attr.value.indexOf(' ');
        if (start !== -1) {
          method_name = attr.value.slice(0, start);
          method_args = attr.value.slice(start + 1);
        } else {
          method_name = attr.value;
          method_args = 'null';
        }
        cache_key = `${modifiers}.${method_name}.${method_args}`;
        code = TRANSPILER_CACHE[cache_key];
        if (!code) {
          if (method_name === '') {
            code = '';
          } else {
            code = `reactor.send(event.target, '${method_name}', ${method_args});`;
          }
          while (modifiers.length) {
            modifier = modifiers.pop();
            modifier = modifier === 'space' ? ' ' : modifier;
            switch (modifier) {
              case 'inlinejs':
                code = attr.value;
                break;
              case 'debounce':
                _name = modifiers.pop();
                _delay = modifiers.pop();
                code = `reactor.debounce('${_name}', ${_delay})(function(){ ${code} })()`;
                break;
              case 'prevent':
                code = "event.preventDefault(); " + code;
                break;
              case 'stop':
                code = "event.stopPropagation(); " + code;
                break;
              case 'ctrl':
                code = `if (event.ctrlKey) { ${code} }`;
                break;
              case 'alt':
                code = `if (event.altKey) { ${code} }`;
                break;
              default:
                code = `if (event.key.toLowerCase() == '${modifier}') { ${code} }; `;
            }
          }
          TRANSPILER_CACHE[cache_key] = code;
        }
        replacements.push({
          old_name: attr.name,
          name: 'on' + name.slice(1),
          code: code
        });
      }
    }
    results = [];
    for (j = 0, len1 = replacements.length; j < len1; j++) {
      ({old_name, name, code} = replacements[j]);
      if (old_name) {
        el.attributes.removeNamedItem(old_name);
      }
      nu_attr = document.createAttribute(name);
      nu_attr.value = code;
      results.push(el.attributes.setNamedItem(nu_attr));
    }
    return results;
  };

  declare_components = function(component_types) {
    var Component, base_element, base_html_element, component_name, results;
    results = [];
    for (component_name in component_types) {
      base_html_element = component_types[component_name];
      if (customElements.get(component_name)) {
        continue;
      }
      base_element = document.createElement(base_html_element);
      Component = (function() {
        var merge_objects;

        class Component extends base_element.constructor {
          constructor(...args) {
            super(...args);
            this.tag_name = this.getAttribute('is');
            this._last_received_html = [];
          }

          state() {
            return JSON.parse(this.getAttribute('state'));
          }

          connectedCallback() {
            eval(this.getAttribute('onreactor-init'));
            this.deep_transpile();
            return this.connect();
          }

          disconnectedCallback() {
            eval(this.getAttribute('onreactor-leave'));
            return reactor_channel.send_leave(this.id);
          }

          deep_transpile(element = null) {
            var child, code, i, len, ref, results1;
            if (element == null) {
              transpile(this);
              element = this;
            }
            ref = element.children;
            results1 = [];
            for (i = 0, len = ref.length; i < len; i++) {
              child = ref[i];
              transpile(child);
              code = child.getAttribute('onreactor-init');
              if (code) {
                (function() {
                  return eval(code);
                }).bind(child)();
              }
              results1.push(this.deep_transpile(child));
            }
            return results1;
          }

          is_root() {
            return !this.parent_component();
          }

          parent_component() {
            var ref;
            return (ref = this.parentElement) != null ? ref.closest('[is]') : void 0;
          }

          connect() {
            if (this.is_root()) {
              return reactor_channel.send_join(this.tag_name, this.state());
            }
          }

          apply_diff(html_diff) {
            var cursor, diff, html, i, len;
            console.log(`${new Date() - origin}ms`);
            html = [];
            cursor = 0;
            for (i = 0, len = html_diff.length; i < len; i++) {
              diff = html_diff[i];
              if (typeof diff === 'string') {
                html.push(diff);
              } else if (diff < 0) {
                cursor -= diff;
              } else {
                html.push(...this._last_received_html.slice(cursor, cursor + diff));
                cursor += diff;
              }
            }
            this._last_received_html = html;
            html = html.join(' ');
            return window.requestAnimationFrame(() => {
              var ref;
              morphdom(this, html, {
                onBeforeElUpdated: (from_el, to_el) => {
                  var ref, should_patch;
                  // Prevent object from being updated
                  if (from_el.hasAttribute(':once')) {
                    return false;
                  }
                  if (from_el.hasAttribute(':keep')) {
                    to_el.value = from_el.value;
                    to_el.checked = from_el.checked;
                  }
                  transpile(to_el);
                  should_patch = from_el === document.activeElement && ((ref = from_el.tagName) === 'INPUT' || ref === 'SELECT' || ref === 'TEXTAREA') && !from_el.hasAttribute(':override');
                  if (should_patch) {
                    to_el.getAttributeNames().forEach(function(name) {
                      return from_el.setAttribute(name, to_el.getAttribute(name));
                    });
                    from_el.readOnly = to_el.readOnly;
                    return false;
                  }
                  return true;
                },
                onElUpdated: function(el) {
                  var code;
                  code = typeof el.getAttribute === "function" ? el.getAttribute('onreactor-updated') : void 0;
                  if (code) {
                    return (function() {
                      return eval(code);
                    }).bind(el)();
                  }
                },
                onNodeAdded: function(el) {
                  var code;
                  transpile(el);
                  code = typeof el.getAttribute === "function" ? el.getAttribute('onreactor-added') : void 0;
                  if (code) {
                    return (function() {
                      return eval(code);
                    }).bind(el)();
                  }
                }
              });
              return (ref = this.querySelector('[\\:focus]:not([disabled])')) != null ? ref.focus() : void 0;
            });
          }

          dispatch(name, form, args) {
            args = merge_objects(this.serialize(form || this), args);
            return reactor_channel.send_user_event(this, name, args);
          }

          serialize(form) {
            var el, i, j, len, len1, obj, option, part, ref, ref1, state, value;
            // Serialize the fields with name attribute and creates a dictionary
            // with them. It support nested name spaces.

            // Ex1:
            //   <input name="a" value="q">
            //   <input name="b" value="x">
            // Result: {a: "q", b: "x"}

            // Ex2:
            //   <input name="query" value="q">
            //   <input name="person.name" value="John">
            //   <input name="person.age" value="99">
            // Result: {query: "q", person: {name: "John", value: "99"}}

            // Ex3:
            //   <input name="query" value="q">
            //   <input name="persons[].name" value="a">
            //   <input name="persons[].name" value="b">
            // Result: {query: "q", persons: [{name: "a"}, {name: "b"}]}
            state = {};
            ref = form.querySelectorAll('[name]');
            for (i = 0, len = ref.length; i < len; i++) {
              el = ref[i];
              if (el.closest('[is]') === this) {
                value = (el.type.toLowerCase() === 'checkbox' ? el.checked ? el.getAttribute('value') || true : null : el.type.toLowerCase() === 'radio' ? el.checked ? el.value || true : null : el.type.toLowerCase() === 'select-multiple' ? (function() {
                  var j, len1, ref1, results1;
                  ref1 = el.selectedOptions;
                  results1 = [];
                  for (j = 0, len1 = ref1.length; j < len1; j++) {
                    option = ref1[j];
                    results1.push(option.value);
                  }
                  return results1;
                })() : el.hasAttribute('contenteditable') ? el.hasAttribute(':as-text') ? el.innerText : el.innerHTML.trim() : el.value);
                if (value === null) {
                  continue;
                }
                ref1 = el.getAttribute('name').split('.').reverse();
                for (j = 0, len1 = ref1.length; j < len1; j++) {
                  part = ref1[j];
                  obj = {};
                  if (part.endsWith('[]')) {
                    obj[part.slice(0, -2)] = [value];
                  } else {
                    obj[part] = value;
                  }
                  value = obj;
                }
                state = merge_objects(state, value);
              }
            }
            return state;
          }

        };

        merge_objects = function(target, source) {
          var k, target_value, v;
          for (k in source) {
            v = source[k];
            target_value = target[k];
            if (Array.isArray(target_value)) {
              target_value.push(...v);
            } else if (typeof target_value === 'object') {
              merge_objects(target_value, v);
            } else {
              target[k] = v;
            }
          }
          return target;
        };

        return Component;

      }).call(this);
      results.push(customElements.define(component_name, Component, {
        extends: base_html_element
      }));
    }
    return results;
  };

  window.reactor = reactor = {};

  reactor.send = function(element, name, args) {
    var component, form;
    component = element.closest('[is]');
    form = element.closest('form');
    if (component != null) {
      form = component.contains(form) ? form : null;
      return component.dispatch(name, form, args);
    }
  };

  _timeouts = {};

  reactor.debounce = function(delay_name, delay) {
    return function(f) {
      return function(...args) {
        clearTimeout(_timeouts[delay_name]);
        return _timeouts[delay_name] = setTimeout((() => {
          return f(...args);
        }), delay);
      };
    };
  };

  reactor.push_state = function(url) {
    if (typeof Turbolinks !== "undefined" && Turbolinks !== null) {
      return Turbolinks.visit(url);
    } else {
      return window.location.assign(url);
    }
  };

  reactor_channel.open();

}).call(this);

//# sourceMappingURL=reactor.js.map
