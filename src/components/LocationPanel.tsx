import React from "react";

export interface LocationSection {
    key: string;
    title: string;
    content: React.ReactNode;
    separatorAfter?: boolean;
}

export default function LocationPanel({sections}: {sections: LocationSection[]}) {
    return (
        <div className="group">
            <div className="info location-panel">
                {sections.map((section) => (
                    <React.Fragment key={section.key}>
                        <div className="location-panel__section">
                            <div className="location-panel__title">{section.title}</div>
                            <div className="location-panel__content">{section.content}</div>
                        </div>
                        {section.separatorAfter ? (
                            <div className="location-panel__separator" aria-hidden="true" />
                        ) : null}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
