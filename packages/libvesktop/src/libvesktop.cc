#include <gio/gio.h>
#include <cstdlib>
#include <cstdint>
#include <iostream>
#include <napi.h>
#include <optional>
#include <cmath>
#include <memory>
#include <map>
#include <string>
#include <vector>
#include <cstring>
#include "status_notifier_item.h"

struct GVariantDeleter
{
    void operator()(GVariant *variant) const
    {
        if (variant)
            g_variant_unref(variant);
    }
};

using GVariantPtr = std::unique_ptr<GVariant, GVariantDeleter>;

struct GErrorDeleter
{
    void operator()(GError *error) const
    {
        if (error)
            g_error_free(error);
    }
};

using GErrorPtr = std::unique_ptr<GError, GErrorDeleter>;

bool update_launcher_count(int count)
{
    GError *error = nullptr;

    const char *chromeDesktop = std::getenv("CHROME_DESKTOP");
    std::string desktop_id = std::string("application://") + (chromeDesktop ? chromeDesktop : "vesktop.desktop");

    GObjectPtr<GDBusConnection> bus(g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &error));
    if (!bus)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[libvesktop::update_launcher_count] Failed to connect to session bus: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    GVariantBuilder builder;
    g_variant_builder_init(&builder, G_VARIANT_TYPE("a{sv}"));
    g_variant_builder_add(&builder, "{sv}", "count", g_variant_new_int64(count));
    g_variant_builder_add(&builder, "{sv}", "count-visible", g_variant_new_boolean(count != 0));

    gboolean result = g_dbus_connection_emit_signal(
        bus.get(),
        nullptr,
        "/",
        "com.canonical.Unity.LauncherEntry",
        "Update",
        g_variant_new("(sa{sv})", desktop_id.c_str(), &builder),
        &error);

    if (!result || error)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[libvesktop::update_launcher_count] Failed to emit Update signal: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    return true;
}

std::optional<int32_t> get_accent_color()
{
    GError *error = nullptr;

    GObjectPtr<GDBusConnection> bus(g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &error));
    if (!bus)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[libvesktop::get_accent_color] Failed to connect to session bus: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return std::nullopt;
    }

    GVariantPtr reply(g_dbus_connection_call_sync(
        bus.get(),
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Settings",
        "Read",
        g_variant_new("(ss)", "org.freedesktop.appearance", "accent-color"),
        nullptr,
        G_DBUS_CALL_FLAGS_NONE,
        5000,
        nullptr,
        &error));

    if (!reply)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[libvesktop::get_accent_color] Failed to call Read: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return std::nullopt;
    }

    GVariant *inner_raw = nullptr;
    g_variant_get(reply.get(), "(v)", &inner_raw);
    if (!inner_raw)
    {
        std::cerr << "[libvesktop::get_accent_color] Inner variant is null" << std::endl;
        return std::nullopt;
    }

    GVariantPtr inner(inner_raw);

    // Unwrap nested variants
    while (g_variant_is_of_type(inner.get(), G_VARIANT_TYPE_VARIANT))
    {
        GVariant *next = g_variant_get_variant(inner.get());
        inner.reset(next);
    }

    if (!g_variant_is_of_type(inner.get(), G_VARIANT_TYPE_TUPLE) ||
        g_variant_n_children(inner.get()) < 3)
    {
        std::cerr << "[libvesktop::get_accent_color] Inner variant is not a tuple of 3 doubles" << std::endl;
        return std::nullopt;
    }

    double r = 0.0, g = 0.0, b = 0.0;
    g_variant_get(inner.get(), "(ddd)", &r, &g, &b);

    bool discard = false;
    auto toInt = [&discard](double v) -> int
    {
        if (!std::isfinite(v) || v < 0.0 || v > 1.0)
        {
            discard = true;
            return 0;
        }

        return static_cast<int>(std::round(v * 255.0));
    };

    int32_t rgb = (toInt(r) << 16) | (toInt(g) << 8) | toInt(b);
    if (discard)
        return std::nullopt;

    return rgb;
}

bool request_background(bool autostart, const std::vector<std::string> &commandline)
{
    GError *error = nullptr;

    GObjectPtr<GDBusConnection> bus(g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &error));
    if (!bus)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[libvesktop::request_background] Failed to connect to session bus: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    GVariantBuilder builder;
    g_variant_builder_init(&builder, G_VARIANT_TYPE("a{sv}"));
    g_variant_builder_add(&builder, "{sv}", "autostart", g_variant_new_boolean(autostart));

    if (!commandline.empty())
    {
        GVariantBuilder cmd_builder;
        g_variant_builder_init(&cmd_builder, G_VARIANT_TYPE("as"));
        for (const auto &s : commandline)
            g_variant_builder_add(&cmd_builder, "s", s.c_str());
        g_variant_builder_add(&builder, "{sv}", "commandline", g_variant_builder_end(&cmd_builder));
    }

    GVariantPtr reply(g_dbus_connection_call_sync(
        bus.get(),
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.Background",
        "RequestBackground",
        g_variant_new("(sa{sv})", "", &builder),
        nullptr,
        G_DBUS_CALL_FLAGS_NONE,
        5000,
        nullptr,
        &error));

    if (!reply)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[libvesktop::request_background] Failed to call RequestBackground: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    return true;
}

static std::unique_ptr<StatusNotifierItem> g_sni_instance;

Napi::Value updateUnityLauncherCount(Napi::CallbackInfo const &info)
{
    if (info.Length() < 1 || !info[0].IsNumber())
    {
        Napi::TypeError::New(info.Env(), "Expected (number)").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    int count = info[0].As<Napi::Number>().Int32Value();
    bool success = update_launcher_count(count);
    return Napi::Boolean::New(info.Env(), success);
}

Napi::Value getAccentColor(const Napi::CallbackInfo &info)
{
    auto color = get_accent_color();
    if (color)
        return Napi::Number::New(info.Env(), *color);
    return info.Env().Null();
}

Napi::Value RequestBackground(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsBoolean() || !info[1].IsArray())
    {
        Napi::TypeError::New(env, "Expected (boolean, string[])").ThrowAsJavaScriptException();
        return env.Null();
    }

    bool autostart = info[0].As<Napi::Boolean>();
    Napi::Array arr = info[1].As<Napi::Array>();
    std::vector<std::string> commandline;
    for (uint32_t i = 0; i < arr.Length(); i++)
    {
        Napi::Value v = arr.Get(i);
        if (v.IsString())
            commandline.push_back(v.As<Napi::String>().Utf8Value());
    }

    bool ok = request_background(autostart, commandline);
    return Napi::Boolean::New(env, ok);
}

Napi::Value InitStatusNotifierItem(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (g_sni_instance)
    {
        return Napi::Boolean::New(env, true);
    }

    g_sni_instance = std::make_unique<StatusNotifierItem>();
    bool success = g_sni_instance->initialize();

    if (!success)
    {
        g_sni_instance.reset();
        return Napi::Boolean::New(env, false);
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value SetStatusNotifierIcon(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer())
    {
        Napi::TypeError::New(env, "Expected (Buffer)").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!g_sni_instance)
    {
        Napi::Error::New(env, "StatusNotifierItem not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    std::vector<uint8_t> pixmap_data(buffer.Data(), buffer.Data() + buffer.Length());

    bool success = g_sni_instance->set_icon_pixmap(pixmap_data);

    return Napi::Boolean::New(env, success);
}

Napi::Value SetStatusNotifierTitle(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
        Napi::TypeError::New(env, "Expected (string)").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!g_sni_instance)
    {
        Napi::Error::New(env, "StatusNotifierItem not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string title = info[0].As<Napi::String>().Utf8Value();
    bool success = g_sni_instance->set_title(title);

    return Napi::Boolean::New(env, success);
}

Napi::Value DestroyStatusNotifierItem(const Napi::CallbackInfo &info)
{
    if (g_sni_instance)
    {
        g_sni_instance.reset();
    }
    return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set("updateUnityLauncherCount", Napi::Function::New(env, updateUnityLauncherCount));
    exports.Set("getAccentColor", Napi::Function::New(env, getAccentColor));
    exports.Set("requestBackground", Napi::Function::New(env, RequestBackground));
    exports.Set("initStatusNotifierItem", Napi::Function::New(env, InitStatusNotifierItem));
    exports.Set("setStatusNotifierIcon", Napi::Function::New(env, SetStatusNotifierIcon));
    exports.Set("setStatusNotifierTitle", Napi::Function::New(env, SetStatusNotifierTitle));
    exports.Set("destroyStatusNotifierItem", Napi::Function::New(env, DestroyStatusNotifierItem));
    return exports;
}

NODE_API_MODULE(libvesktop, Init)
