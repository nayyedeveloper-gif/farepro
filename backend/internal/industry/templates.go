package industry

type ChannelTemplate struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Template struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Channels    []ChannelTemplate `json:"channels"`
}

// Taxi / delivery focused — retail, hospitality, and other verticals deferred.
var templates = []Template{
	{
		ID:          "transportation",
		Name:        "Kilo Taxi / Transport",
		Description: "Fleet dispatch and driver coordination",
		Channels: []ChannelTemplate{
			{Name: "Drivers Community", Description: "org-community:drivers"},
			{Name: "Admin Support", Description: "org-community:support"},
			{Name: "Dispatch", Description: "Central dispatch coordination"},
			{Name: "Drivers On Duty", Description: "Active drivers"},
			{Name: "Emergency", Description: "Road incidents and urgent support"},
		},
	},
	{
		ID:          "general",
		Name:        "General",
		Description: "Starter channels for any team",
		Channels: []ChannelTemplate{
			{Name: "All Staff", Description: "Company-wide announcements and updates"},
			{Name: "Dispatch", Description: "Operations coordination"},
			{Name: "Emergency", Description: "Urgent alerts and incidents"},
		},
	},
}

func ListTemplates() []Template {
	out := make([]Template, len(templates))
	copy(out, templates)
	return out
}

func GetTemplate(id string) (Template, bool) {
	for _, t := range templates {
		if t.ID == id {
			return t, true
		}
	}
	return Template{}, false
}

func NormalizeIndustry(id string) string {
	if id == "" {
		return "transportation"
	}
	if _, ok := GetTemplate(id); ok {
		return id
	}
	return "general"
}
