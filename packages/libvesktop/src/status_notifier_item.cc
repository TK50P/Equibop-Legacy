#include "status_notifier_item.h"
#include <iostream>
#include <cstring>
#include <unistd.h>

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

const char *StatusNotifierItem::introspection_xml = R"XML(
<node>
  <interface name="org.kde.StatusNotifierItem">
    <property name="Category" type="s" access="read"/>
    <property name="Id" type="s" access="read"/>
    <property name="Title" type="s" access="read"/>
    <property name="Status" type="s" access="read"/>
    <property name="IconName" type="s" access="read"/>
    <property name="IconPixmap" type="a(iiay)" access="read"/>
    <property name="AttentionIconName" type="s" access="read"/>
    <property name="ToolTip" type="(sa(iiay)ss)" access="read"/>
    <property name="ItemIsMenu" type="b" access="read"/>
    <property name="Menu" type="o" access="read"/>
    <method name="Activate">
      <arg type="i" name="x" direction="in"/>
      <arg type="i" name="y" direction="in"/>
    </method>
    <method name="SecondaryActivate">
      <arg type="i" name="x" direction="in"/>
      <arg type="i" name="y" direction="in"/>
    </method>
    <method name="ContextMenu">
      <arg type="i" name="x" direction="in"/>
      <arg type="i" name="y" direction="in"/>
    </method>
    <method name="Scroll">
      <arg type="i" name="delta" direction="in"/>
      <arg type="s" name="orientation" direction="in"/>
    </method>
    <signal name="NewIcon"/>
    <signal name="NewTitle"/>
    <signal name="NewStatus">
      <arg type="s" name="status"/>
    </signal>
  </interface>
</node>
)XML";

void StatusNotifierItem::handle_method_call(
    GDBusConnection *connection,
    const gchar *sender,
    const gchar *object_path,
    const gchar *interface_name,
    const gchar *method_name,
    GVariant *parameters,
    GDBusMethodInvocation *invocation,
    gpointer user_data)
{
    (void)connection;
    (void)sender;
    (void)object_path;
    (void)interface_name;
    (void)parameters;
    (void)user_data;

    if (g_strcmp0(method_name, "Activate") == 0)
    {
        g_dbus_method_invocation_return_value(invocation, nullptr);
    }
    else if (g_strcmp0(method_name, "SecondaryActivate") == 0)
    {
        g_dbus_method_invocation_return_value(invocation, nullptr);
    }
    else if (g_strcmp0(method_name, "ContextMenu") == 0)
    {
        g_dbus_method_invocation_return_value(invocation, nullptr);
    }
    else if (g_strcmp0(method_name, "Scroll") == 0)
    {
        g_dbus_method_invocation_return_value(invocation, nullptr);
    }
}

GVariant *StatusNotifierItem::handle_get_property(
    GDBusConnection *connection,
    const gchar *sender,
    const gchar *object_path,
    const gchar *interface_name,
    const gchar *property_name,
    GError **error,
    gpointer user_data)
{
    auto *self = static_cast<StatusNotifierItem *>(user_data);

    if (g_strcmp0(property_name, "Category") == 0)
    {
        return g_variant_new_string("Communications");
    }
    else if (g_strcmp0(property_name, "Id") == 0)
    {
        return g_variant_new_string("equibop");
    }
    else if (g_strcmp0(property_name, "Title") == 0)
    {
        return g_variant_new_string(self->current_title.c_str());
    }
    else if (g_strcmp0(property_name, "Status") == 0)
    {
        return g_variant_new_string(self->current_status.c_str());
    }
    else if (g_strcmp0(property_name, "IconName") == 0)
    {
        return g_variant_new_string("");
    }
    else if (g_strcmp0(property_name, "IconPixmap") == 0)
    {
        if (!self->current_icon_pixmap.empty() && self->current_icon_pixmap.size() >= 8)
        {
            GVariantBuilder builder;
            g_variant_builder_init(&builder, G_VARIANT_TYPE("a(iiay)"));

            int width, height;
            memcpy(&width, self->current_icon_pixmap.data(), 4);
            memcpy(&height, self->current_icon_pixmap.data() + 4, 4);

            GVariantBuilder data_builder;
            g_variant_builder_init(&data_builder, G_VARIANT_TYPE("ay"));

            for (size_t i = 8; i < self->current_icon_pixmap.size(); i++)
            {
                g_variant_builder_add(&data_builder, "y", self->current_icon_pixmap[i]);
            }

            g_variant_builder_add(&builder, "(ii@ay)",
                width,
                height,
                g_variant_builder_end(&data_builder));

            return g_variant_builder_end(&builder);
        }
        return g_variant_new_array(G_VARIANT_TYPE("(iiay)"), nullptr, 0);
    }
    else if (g_strcmp0(property_name, "AttentionIconName") == 0)
    {
        return g_variant_new_string("");
    }
    else if (g_strcmp0(property_name, "ToolTip") == 0)
    {
        GVariantBuilder builder;
        g_variant_builder_init(&builder, G_VARIANT_TYPE("(sa(iiay)ss)"));
        g_variant_builder_add(&builder, "s", "equibop");
        g_variant_builder_open(&builder, G_VARIANT_TYPE("a(iiay)"));
        g_variant_builder_close(&builder);
        g_variant_builder_add(&builder, "s", self->current_title.c_str());
        g_variant_builder_add(&builder, "s", "");
        return g_variant_builder_end(&builder);
    }
    else if (g_strcmp0(property_name, "ItemIsMenu") == 0)
    {
        return g_variant_new_boolean(FALSE);
    }
    else if (g_strcmp0(property_name, "Menu") == 0)
    {
        return g_variant_new_object_path("/MenuBar");
    }

    return nullptr;
}

StatusNotifierItem::StatusNotifierItem()
{
    GError *error = nullptr;
    bus.reset(g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &error));

    if (!bus)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[StatusNotifierItem] Failed to connect to session bus: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return;
    }

    service_name = "org.kde.StatusNotifierItem-" + std::to_string(getpid()) + "-1";
    object_path = "/StatusNotifierItem";
}

StatusNotifierItem::~StatusNotifierItem()
{
    if (bus && registration_id != 0)
    {
        g_dbus_connection_unregister_object(bus.get(), registration_id);
    }
}

bool StatusNotifierItem::initialize()
{
    if (!bus)
        return false;

    GError *error = nullptr;

    static GDBusInterfaceVTable vtable = {
        handle_method_call,
        handle_get_property,
        nullptr,
        {}
    };

    GDBusNodeInfo *node_info = g_dbus_node_info_new_for_xml(introspection_xml, &error);
    if (!node_info)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[StatusNotifierItem] Failed to parse introspection XML: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    registration_id = g_dbus_connection_register_object(
        bus.get(),
        object_path.c_str(),
        node_info->interfaces[0],
        &vtable,
        this,
        nullptr,
        &error);

    g_dbus_node_info_unref(node_info);

    if (registration_id == 0)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[StatusNotifierItem] Failed to register object: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    GBusNameOwnerFlags flags = static_cast<GBusNameOwnerFlags>(
        G_BUS_NAME_OWNER_FLAGS_ALLOW_REPLACEMENT | G_BUS_NAME_OWNER_FLAGS_REPLACE);

    guint owner_id = g_bus_own_name_on_connection(
        bus.get(),
        service_name.c_str(),
        flags,
        nullptr,
        nullptr,
        nullptr,
        nullptr);

    if (owner_id == 0)
    {
        std::cerr << "[StatusNotifierItem] Failed to own name on bus" << std::endl;
        return false;
    }

    return true;
}

bool StatusNotifierItem::register_with_watcher()
{
    if (!bus || registered_with_watcher)
        return true;

    GError *error = nullptr;

    GVariantPtr reply(g_dbus_connection_call_sync(
        bus.get(),
        WATCHER_SERVICE,
        WATCHER_PATH,
        WATCHER_SERVICE,
        "RegisterStatusNotifierItem",
        g_variant_new("(s)", service_name.c_str()),
        nullptr,
        G_DBUS_CALL_FLAGS_NONE,
        -1,
        nullptr,
        &error));

    if (!reply)
    {
        GErrorPtr error_ptr(error);
        std::cerr << "[StatusNotifierItem] Failed to register with watcher: "
                  << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
        return false;
    }

    g_dbus_connection_emit_signal(
        bus.get(),
        nullptr,
        object_path.c_str(),
        SNI_INTERFACE,
        "NewStatus",
        g_variant_new("(s)", "Active"),
        nullptr);

    registered_with_watcher = true;
    return true;
}

bool StatusNotifierItem::set_icon_pixmap(const std::vector<uint8_t> &pixmap_data)
{
    if (!bus)
        return false;

    current_icon_pixmap = pixmap_data;

    if (!registered_with_watcher)
    {
        if (!register_with_watcher())
        {
            std::cerr << "[StatusNotifierItem] Failed to register with watcher after setting icon" << std::endl;
            return false;
        }
    }
    else
    {
        GError *error = nullptr;
        gboolean result = g_dbus_connection_emit_signal(
            bus.get(),
            nullptr,
            object_path.c_str(),
            SNI_INTERFACE,
            "NewIcon",
            nullptr,
            &error);

        if (!result || error)
        {
            GErrorPtr error_ptr(error);
            std::cerr << "[StatusNotifierItem] Failed to emit NewIcon signal: "
                      << (error_ptr ? error_ptr->message : "unknown error") << std::endl;
            return false;
        }
    }

    return true;
}

bool StatusNotifierItem::set_title(const std::string &title)
{
    if (!bus || title == current_title)
        return true;

    current_title = title;

    GError *error = nullptr;
    gboolean result = g_dbus_connection_emit_signal(
        bus.get(),
        nullptr,
        object_path.c_str(),
        SNI_INTERFACE,
        "NewTitle",
        nullptr,
        &error);

    if (!result || error)
    {
        GErrorPtr error_ptr(error);
        return false;
    }

    return true;
}
