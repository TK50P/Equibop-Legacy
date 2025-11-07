#pragma once

#include <gio/gio.h>
#include <memory>
#include <string>
#include <vector>

template <typename T>
struct GObjectDeleter
{
    void operator()(T *obj) const
    {
        if (obj)
            g_object_unref(obj);
    }
};

template <typename T>
using GObjectPtr = std::unique_ptr<T, GObjectDeleter<T>>;

class StatusNotifierItem
{
private:
    GObjectPtr<GDBusConnection> bus;
    guint registration_id = 0;
    guint watcher_id = 0;
    bool registered_with_watcher = false;
    std::string service_name;
    std::string object_path;
    std::string current_status = "Active";
    std::string current_icon_path;
    std::string current_title = "Equibop";
    std::vector<uint8_t> current_icon_pixmap;

    static constexpr const char *WATCHER_SERVICE = "org.kde.StatusNotifierWatcher";
    static constexpr const char *WATCHER_PATH = "/StatusNotifierWatcher";
    static constexpr const char *SNI_INTERFACE = "org.kde.StatusNotifierItem";

    static const char *introspection_xml;

    static void handle_method_call(
        GDBusConnection *connection,
        const gchar *sender,
        const gchar *object_path,
        const gchar *interface_name,
        const gchar *method_name,
        GVariant *parameters,
        GDBusMethodInvocation *invocation,
        gpointer user_data);

    static GVariant *handle_get_property(
        GDBusConnection *connection,
        const gchar *sender,
        const gchar *object_path,
        const gchar *interface_name,
        const gchar *property_name,
        GError **error,
        gpointer user_data);

    bool register_with_watcher();

public:
    StatusNotifierItem();
    ~StatusNotifierItem();

    bool initialize();
    bool set_icon_pixmap(const std::vector<uint8_t> &pixmap_data);
    bool set_title(const std::string &title);
};
